import type { Request, Response } from "express";
import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireWriteAccess } from "../middleware/auth";

const apiKeysRouter = Router();

const createApiKeyBodySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

function generateApiKey(): { plainKey: string; keyHash: string; keyPrefix: string } {
  const randomPart = randomBytes(24).toString("base64url");
  const plainKey = `alib_${randomPart}`;
  const keyHash = createHash("sha256").update(plainKey).digest("hex");
  const keyPrefix = plainKey.slice(0, 12);
  return { plainKey, keyHash, keyPrefix };
}

apiKeysRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  const auth = req.session.auth;
  if (!auth) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Not authenticated." },
    });
  }

  const keys = await prisma.apiKey.findMany({
    where: {
      userId: auth.userId,
      revokedAt: null,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return res.status(200).json({ data: keys });
});

apiKeysRouter.post("/", requireAuth, requireWriteAccess, async (req: Request, res: Response) => {
  const auth = req.session.auth;
  if (!auth) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Not authenticated." },
    });
  }

  const parsed = createApiKeyBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid request body.",
        details: parsed.error.flatten(),
      },
    });
  }

  const { name, expiresInDays } = parsed.data;
  const { plainKey, keyHash, keyPrefix } = generateApiKey();

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const apiKey = await prisma.apiKey.create({
    data: {
      userId: auth.userId,
      teamId: auth.teamId,
      name,
      keyHash,
      keyPrefix,
      expiresAt,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return res.status(201).json({
    data: {
      ...apiKey,
      key: plainKey,
    },
  });
});

apiKeysRouter.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const auth = req.session.auth;
  if (!auth) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Not authenticated." },
    });
  }

  const idParam = req.params.id;
  const keyId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);
  if (isNaN(keyId)) {
    return res.status(400).json({
      error: { code: "BAD_REQUEST", message: "Invalid key ID." },
    });
  }

  const existingKey = await prisma.apiKey.findFirst({
    where: {
      id: keyId,
      userId: auth.userId,
      revokedAt: null,
    },
  });

  if (!existingKey) {
    return res.status(404).json({
      error: { code: "NOT_FOUND", message: "API key not found." },
    });
  }

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { revokedAt: new Date() },
  });

  return res.status(200).json({ data: { ok: true } });
});

export { apiKeysRouter };
