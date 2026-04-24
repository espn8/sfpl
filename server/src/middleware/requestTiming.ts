import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { NextFunction, Request, Response } from "express";

export type PerfContext = {
  requestId: string;
  method: string;
  url: string;
  startedAt: number;
  sections: Array<{ label: string; durationMs: number }>;
};

const perfStorage = new AsyncLocalStorage<PerfContext>();

export function isPerfLogEnabled(): boolean {
  return process.env.PERF_LOG === "1";
}

export function getPerfContext(): PerfContext | undefined {
  return perfStorage.getStore();
}

export function recordTiming(label: string, durationMs: number): void {
  const ctx = perfStorage.getStore();
  if (!ctx) return;
  ctx.sections.push({ label, durationMs });
}

export async function timeSection<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!isPerfLogEnabled()) {
    return fn();
  }
  const start = performance.now();
  try {
    return await fn();
  } finally {
    recordTiming(label, performance.now() - start);
  }
}

function formatNumber(value: number): string {
  return value.toFixed(1);
}

function buildServerTimingHeader(sections: PerfContext["sections"], totalMs: number): string {
  const parts: string[] = [`total;dur=${formatNumber(totalMs)}`];
  for (const section of sections) {
    const safeLabel = section.label.replace(/[^a-zA-Z0-9_.-]/g, "_");
    parts.push(`${safeLabel};dur=${formatNumber(section.durationMs)}`);
  }
  return parts.join(", ");
}

function buildLogLine(ctx: PerfContext, totalMs: number, status: number, bytes: number | undefined): string {
  const req = (perfStorage.getStore() as PerfContext | undefined) ?? ctx;
  const sectionsStr = req.sections
    .map((s) => `${s.label}=${formatNumber(s.durationMs)}ms`)
    .join(" ");
  const bytesStr = bytes !== undefined ? `bytes=${bytes}` : "";
  return `[perf] ${req.method} ${req.url} status=${status} total=${formatNumber(totalMs)}ms ${bytesStr} req=${req.requestId} ${sectionsStr}`.trim();
}

export function requestTimingMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!isPerfLogEnabled()) {
    return next();
  }

  const ctx: PerfContext = {
    requestId: randomUUID(),
    method: req.method,
    url: req.originalUrl || req.url,
    startedAt: performance.now(),
    sections: [],
  };

  res.setHeader("X-Request-Id", ctx.requestId);

  let headerSet = false;
  const applyServerTiming = () => {
    if (headerSet || res.headersSent) return;
    headerSet = true;
    const totalMs = performance.now() - ctx.startedAt;
    try {
      res.setHeader("Server-Timing", buildServerTimingHeader(ctx.sections, totalMs));
      res.setHeader("Access-Control-Expose-Headers", "Server-Timing, X-Request-Id");
    } catch {
      // headers may already be flushed; ignore
    }
  };

  const originalWriteHead = res.writeHead.bind(res) as Response["writeHead"];
  res.writeHead = function patchedWriteHead(this: Response, ...args: Parameters<Response["writeHead"]>): Response {
    applyServerTiming();
    return originalWriteHead(...args);
  } as Response["writeHead"];

  res.on("finish", () => {
    const totalMs = performance.now() - ctx.startedAt;
    const bytesHeader = res.getHeader("Content-Length");
    const bytes = typeof bytesHeader === "string" ? Number(bytesHeader) : typeof bytesHeader === "number" ? bytesHeader : undefined;
    // eslint-disable-next-line no-console
    console.log(buildLogLine(ctx, totalMs, res.statusCode, Number.isFinite(bytes) ? bytes : undefined));
  });

  perfStorage.run(ctx, () => {
    next();
  });
}

export { perfStorage };
