import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { PromptModality } from "@prisma/client";
import { env } from "../../config/env";
import { generatePromptThumbnail } from "../../services/nanoBanana";

const v1Router = Router();

async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "API key required. Use Authorization: Bearer <api_key>" },
    });
    return;
  }

  const token = authHeader.slice(7);
  if (!token.startsWith("alib_")) {
    res.status(401).json({
      error: { code: "INVALID_API_KEY", message: "Invalid API key format." },
    });
    return;
  }

  const keyHash = createHash("sha256").update(token).digest("hex");

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      user: {
        select: {
          id: true,
          teamId: true,
          role: true,
          ou: true,
        },
      },
    },
  });

  if (!apiKey) {
    res.status(401).json({
      error: { code: "INVALID_API_KEY", message: "Invalid API key." },
    });
    return;
  }

  if (apiKey.revokedAt) {
    res.status(401).json({
      error: { code: "API_KEY_REVOKED", message: "This API key has been revoked." },
    });
    return;
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    res.status(401).json({
      error: { code: "API_KEY_EXPIRED", message: "This API key has expired." },
    });
    return;
  }

  if (apiKey.user.role === "VIEWER") {
    res.status(403).json({
      error: { code: "FORBIDDEN", message: "Viewer accounts cannot create content via API." },
    });
    return;
  }

  req.apiKeyAuth = {
    userId: apiKey.user.id,
    teamId: apiKey.user.teamId,
    role: apiKey.user.role,
    userOu: apiKey.user.ou,
    apiKeyId: apiKey.id,
  };

  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  next();
}

v1Router.use(requireApiKey);

const PROMPT_TOOLS = ["chatgpt", "claude_code", "claude_cowork", "cursor", "gemini", "meshmesh", "notebooklm", "other", "saleo", "slackbot"] as const;
const promptToolSchema = z.enum(PROMPT_TOOLS);
const API_MODALITIES = ["text", "code", "image", "video", "audio", "multimodal"] as const;
const apiModalitySchema = z.enum(API_MODALITIES);
type ApiModality = (typeof API_MODALITIES)[number];

const apiToDbModality: Record<ApiModality, PromptModality> = {
  text: PromptModality.TEXT,
  code: PromptModality.CODE,
  image: PromptModality.IMAGE,
  video: PromptModality.VIDEO,
  audio: PromptModality.AUDIO,
  multimodal: PromptModality.MULTIMODAL,
};

function getBaseUrl(): string {
  return env.appBaseUrl || "https://ailibrary.example.com";
}

const createPromptSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  body: z.string().min(1, "body is required"),
  summary: z.string().trim().optional(),
  tools: z.array(z.string()).optional().default(["cursor"]),
  modality: apiModalitySchema.optional().default("text"),
  visibility: z.enum(["PUBLIC", "TEAM", "PRIVATE"]).optional().default("PUBLIC"),
  publish: z.boolean().optional().default(false),
});

v1Router.post("/prompts", async (req: Request, res: Response) => {
  const auth = req.apiKeyAuth;
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated." } });
  }

  const parsed = createPromptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid request body.",
        details: parsed.error.flatten(),
      },
    });
  }

  const { title, body, summary, tools, modality, visibility, publish } = parsed.data;

  const validTools = tools.filter((t): t is (typeof PROMPT_TOOLS)[number] =>
    PROMPT_TOOLS.includes(t as (typeof PROMPT_TOOLS)[number])
  );

  const prompt = await prisma.prompt.create({
    data: {
      teamId: auth.teamId,
      ownerId: auth.userId,
      title,
      body,
      summary: summary || null,
      tools: validTools.length > 0 ? validTools : ["cursor"],
      modality: apiToDbModality[modality],
      visibility,
      status: publish ? "PUBLISHED" : "DRAFT",
    },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
    },
  });

  setImmediate(async () => {
    try {
      const thumbnailUrl = await generatePromptThumbnail({ title, summary: summary || null, body });
      await prisma.prompt.update({
        where: { id: prompt.id },
        data: { thumbnailUrl, thumbnailStatus: "READY" },
      });
    } catch {
      await prisma.prompt.update({
        where: { id: prompt.id },
        data: { thumbnailStatus: "FAILED" },
      });
    }
  });

  return res.status(201).json({
    data: {
      id: prompt.id,
      title: prompt.title,
      status: prompt.status,
      url: `${getBaseUrl()}/prompts/${prompt.id}`,
      createdAt: prompt.createdAt.toISOString(),
    },
  });
});

const ARCHIVE_EXTENSIONS = [".zip", ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".7z", ".rar"];

function isValidArchiveUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    return ARCHIVE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

const createSkillSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  skillUrl: z.string().url("skillUrl must be a valid URL").refine(isValidArchiveUrl, {
    message: "skillUrl must link to a compressed file (.zip, .tar, .tar.gz, .tgz, .tar.bz2, .7z, or .rar)",
  }),
  summary: z.string().trim().optional(),
  supportUrl: z.string().url().optional().or(z.literal("")),
  tools: z.array(z.string()).optional().default(["cursor"]),
  visibility: z.enum(["PUBLIC", "TEAM", "PRIVATE"]).optional().default("PUBLIC"),
  publish: z.boolean().optional().default(false),
});

v1Router.post("/skills", async (req: Request, res: Response) => {
  const auth = req.apiKeyAuth;
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated." } });
  }

  const parsed = createSkillSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid request body.",
        details: parsed.error.flatten(),
      },
    });
  }

  const { title, skillUrl, summary, supportUrl, tools, visibility, publish } = parsed.data;

  const validTools = tools.filter((t): t is (typeof PROMPT_TOOLS)[number] =>
    PROMPT_TOOLS.includes(t as (typeof PROMPT_TOOLS)[number])
  );

  const skill = await prisma.skill.create({
    data: {
      teamId: auth.teamId,
      ownerId: auth.userId,
      title,
      skillUrl,
      summary: summary || null,
      supportUrl: supportUrl || null,
      tools: validTools.length > 0 ? validTools : ["cursor"],
      visibility,
      status: publish ? "PUBLISHED" : "DRAFT",
    },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
    },
  });

  setImmediate(async () => {
    try {
      const thumbnailUrl = await generatePromptThumbnail({ title, summary: summary || null, body: summary || title });
      await prisma.skill.update({
        where: { id: skill.id },
        data: { thumbnailUrl, thumbnailStatus: "READY" },
      });
    } catch {
      await prisma.skill.update({
        where: { id: skill.id },
        data: { thumbnailStatus: "FAILED" },
      });
    }
  });

  return res.status(201).json({
    data: {
      id: skill.id,
      title: skill.title,
      status: skill.status,
      url: `${getBaseUrl()}/skills/${skill.id}`,
      createdAt: skill.createdAt.toISOString(),
    },
  });
});

const createContextSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  body: z.string().min(1, "body is required"),
  summary: z.string().trim().optional(),
  tools: z.array(z.string()).optional().default(["cursor"]),
  visibility: z.enum(["PUBLIC", "TEAM", "PRIVATE"]).optional().default("PUBLIC"),
  publish: z.boolean().optional().default(false),
});

v1Router.post("/context", async (req: Request, res: Response) => {
  const auth = req.apiKeyAuth;
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated." } });
  }

  const parsed = createContextSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid request body.",
        details: parsed.error.flatten(),
      },
    });
  }

  const { title, body, summary, tools, visibility, publish } = parsed.data;

  const validTools = tools.filter((t): t is (typeof PROMPT_TOOLS)[number] =>
    PROMPT_TOOLS.includes(t as (typeof PROMPT_TOOLS)[number])
  );

  const context = await prisma.contextDocument.create({
    data: {
      teamId: auth.teamId,
      ownerId: auth.userId,
      title,
      body,
      summary: summary || null,
      tools: validTools.length > 0 ? validTools : ["cursor"],
      visibility,
      status: publish ? "PUBLISHED" : "DRAFT",
    },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
    },
  });

  setImmediate(async () => {
    try {
      const thumbnailUrl = await generatePromptThumbnail({ title, summary: summary || null, body });
      await prisma.contextDocument.update({
        where: { id: context.id },
        data: { thumbnailUrl, thumbnailStatus: "READY" },
      });
    } catch {
      await prisma.contextDocument.update({
        where: { id: context.id },
        data: { thumbnailStatus: "FAILED" },
      });
    }
  });

  return res.status(201).json({
    data: {
      id: context.id,
      title: context.title,
      status: context.status,
      url: `${getBaseUrl()}/context/${context.id}`,
      createdAt: context.createdAt.toISOString(),
    },
  });
});

const createBuildSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  buildUrl: z.string().url("buildUrl must be a valid URL"),
  summary: z.string().trim().optional(),
  supportUrl: z.string().url().optional().or(z.literal("")),
  visibility: z.enum(["PUBLIC", "TEAM", "PRIVATE"]).optional().default("PUBLIC"),
  publish: z.boolean().optional().default(false),
});

v1Router.post("/builds", async (req: Request, res: Response) => {
  const auth = req.apiKeyAuth;
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated." } });
  }

  const parsed = createBuildSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid request body.",
        details: parsed.error.flatten(),
      },
    });
  }

  const { title, buildUrl, summary, supportUrl, visibility, publish } = parsed.data;

  const build = await prisma.build.create({
    data: {
      teamId: auth.teamId,
      ownerId: auth.userId,
      title,
      buildUrl,
      summary: summary || null,
      supportUrl: supportUrl || null,
      visibility,
      status: publish ? "PUBLISHED" : "DRAFT",
    },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
    },
  });

  setImmediate(async () => {
    try {
      const thumbnailUrl = await generatePromptThumbnail({ title, summary: summary || null, body: summary || title });
      await prisma.build.update({
        where: { id: build.id },
        data: { thumbnailUrl, thumbnailStatus: "READY" },
      });
    } catch {
      await prisma.build.update({
        where: { id: build.id },
        data: { thumbnailStatus: "FAILED" },
      });
    }
  });

  return res.status(201).json({
    data: {
      id: build.id,
      title: build.title,
      status: build.status,
      url: `${getBaseUrl()}/builds/${build.id}`,
      createdAt: build.createdAt.toISOString(),
    },
  });
});

v1Router.get("/me", async (req: Request, res: Response) => {
  const auth = req.apiKeyAuth;
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated." } });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      teamId: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
  }

  return res.status(200).json({ data: user });
});

export { v1Router };
