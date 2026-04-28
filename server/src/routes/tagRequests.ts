import { Role, type TagRequestStatus } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import {
  getAuthContext,
  requireAuth,
  requireOnboardingComplete,
  requireRole,
  requireWriteAccess,
} from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { normalizeTagNameForStorage } from "../lib/assetTags";
import { sendTagRequestNotification } from "../services/email";

const tagRequestsRouter = Router();

const createTagRequestSchema = z.object({
  requestedName: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  submitterFirstName: z.string().trim().min(1).max(100),
  submitterLastName: z.string().trim().min(1).max(100),
});

const reviewTagRequestSchema = z.object({
  status: z.enum(["APPROVED", "DECLINED", "ON_HOLD"]),
  reviewNotes: z.string().max(1000).optional(),
});

const listQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "DECLINED", "ON_HOLD"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

function badRequestFromZodError(error: z.ZodError) {
  return {
    error: {
      code: "BAD_REQUEST",
      message: "Invalid request.",
      details: error.issues,
    },
  };
}

tagRequestsRouter.use(requireAuth);
tagRequestsRouter.use(requireOnboardingComplete);

tagRequestsRouter.post("/", requireWriteAccess, async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsed = createTagRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(badRequestFromZodError(parsed.error));
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true },
  });
  if (!user?.email) {
    return res.status(404).json({ error: { code: "USER_NOT_FOUND", message: "User not found." } });
  }

  const canonicalName = normalizeTagNameForStorage(parsed.data.requestedName);
  if (canonicalName.length === 0) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid tag name." } });
  }

  const existingTag = await prisma.tag.findFirst({
    where: { name: { equals: canonicalName, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingTag) {
    return res.status(409).json({
      error: { code: "CONFLICT", message: "That tag already exists." },
    });
  }

  const pendingDup = await prisma.tagRequest.findFirst({
    where: {
      status: "PENDING",
      requestedName: { equals: parsed.data.requestedName.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });
  if (pendingDup) {
    return res.status(409).json({
      error: { code: "CONFLICT", message: "A pending request already exists for this name." },
    });
  }

  const row = await prisma.tagRequest.create({
    data: {
      requestedName: parsed.data.requestedName.trim(),
      description: parsed.data.description?.trim() || null,
      submitterFirstName: parsed.data.submitterFirstName.trim(),
      submitterLastName: parsed.data.submitterLastName.trim(),
      submitterEmail: user.email,
    },
  });

  sendTagRequestNotification(row).catch((err) => {
    console.error("Failed to send tag request notification:", err);
  });

  return res.status(201).json({ data: row });
});

tagRequestsRouter.get("/", requireRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(badRequestFromZodError(parsed.error));
  }

  const { status, page, pageSize } = parsed.data;
  const where = status ? { status: status as TagRequestStatus } : {};

  const [rows, total] = await Promise.all([
    prisma.tagRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        reviewedBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.tagRequest.count({ where }),
  ]);

  return res.status(200).json({
    data: rows,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});

tagRequestsRouter.patch("/:id", requireRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const paramsParsed = idParamsSchema.safeParse(req.params);
  const bodyParsed = reviewTagRequestSchema.safeParse(req.body);
  if (!paramsParsed.success) {
    return res.status(400).json(badRequestFromZodError(paramsParsed.error));
  }
  if (!bodyParsed.success) {
    return res.status(400).json(badRequestFromZodError(bodyParsed.error));
  }

  const id = paramsParsed.data.id;
  const existing = await prisma.tagRequest.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Request not found." } });
  }

  const nextStatus = bodyParsed.data.status as TagRequestStatus;

  if (nextStatus === "APPROVED") {
    const storedName = normalizeTagNameForStorage(existing.requestedName);
    const dup = await prisma.tag.findFirst({
      where: { name: { equals: storedName, mode: "insensitive" } },
    });
    if (dup) {
      await prisma.tagRequest.update({
        where: { id },
        data: {
          status: "DECLINED",
          reviewedAt: new Date(),
          reviewedById: auth.userId,
          reviewNotes: bodyParsed.data.reviewNotes ?? "Tag already existed at approval time.",
        },
      });
      return res.status(409).json({
        error: { code: "CONFLICT", message: "Tag already exists." },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.tag.create({
        data: { name: storedName },
      });
      return tx.tagRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedAt: new Date(),
          reviewedById: auth.userId,
          reviewNotes: bodyParsed.data.reviewNotes ?? null,
        },
        include: {
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
      });
    });

    return res.status(200).json({
      data: updated,
    });
  }

  const updated = await prisma.tagRequest.update({
    where: { id },
    data: {
      status: nextStatus,
      reviewedAt: new Date(),
      reviewedById: auth.userId,
      reviewNotes: bodyParsed.data.reviewNotes ?? null,
    },
  });

  return res.status(200).json({ data: updated });
});

export { tagRequestsRouter };
