import type { NextFunction, Request, Response } from "express";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";

export async function authenticateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.session.auth) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.slice(7);
  if (!token.startsWith("alib_")) {
    return next();
  }

  const keyHash = createHash("sha256").update(token).digest("hex");

  try {
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

    req.session.auth = {
      userId: apiKey.user.id,
      teamId: apiKey.user.teamId,
      role: apiKey.user.role,
      userOu: apiKey.user.ou,
    };

    prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    next();
  } catch (_error) {
    res.status(500).json({
      error: { code: "AUTH_ERROR", message: "Failed to authenticate API key." },
    });
  }
}
