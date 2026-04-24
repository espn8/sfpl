import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function keyGenerator(req: Request): string {
  if (req.session.auth?.userId) {
    return `uid:${req.session.auth.userId}`;
  }
  return ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? "unknown");
}

const authRateLimit = rateLimit({
  windowMs: parsePositiveInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  limit: parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 60),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many authentication requests. Please try again later.",
    },
  },
});

const aiRewriteRateLimit = rateLimit({
  windowMs: parsePositiveInt(process.env.AI_REWRITE_RATE_LIMIT_WINDOW_MS, 60 * 1000),
  limit: parsePositiveInt(process.env.AI_REWRITE_RATE_LIMIT_MAX, 20),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many AI rewrite requests. Please wait a moment and try again.",
    },
  },
});

export { authRateLimit, aiRewriteRateLimit };
