import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const contextRouter = Router();

const promptVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
const promptStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

const MAX_BODY_LENGTH = 500_000;

function badRequestFromZodError(error: z.ZodError) {
  return {
    error: {
      code: "BAD_REQUEST",
      message: "Invalid request.",
      details: error.issues,
    },
  };
}

function isAdminOrOwner(role: string): boolean {
  return role === "ADMIN" || role === "OWNER";
}

const listContextQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: promptStatusSchema.optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const contextIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createContextBodySchema = z.object({
  title: z.string().trim().min(1, "title is required."),
  summary: z.string().trim().optional(),
  body: z.string().min(1, "body is required.").max(MAX_BODY_LENGTH, "body is too long."),
  visibility: promptVisibilitySchema.optional(),
  status: promptStatusSchema.optional(),
});

const updateContextBodySchema = z
  .object({
    title: z.string().trim().optional(),
    summary: z.string().trim().optional(),
    body: z.string().min(1).max(MAX_BODY_LENGTH, "body is too long.").optional(),
    visibility: promptVisibilitySchema.optional(),
    status: promptStatusSchema.optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    "At least one field must be provided.",
  );

function serializeContextDoc<T extends { owner: { id: number; name: string | null; avatarUrl: string | null } }>(
  row: T,
): Omit<T, "owner"> & { owner: { id: number; name: string | null; avatarUrl: string | null } } {
  return {
    ...row,
    owner: {
      id: row.owner.id,
      name: row.owner.name,
      avatarUrl: row.owner.avatarUrl,
    },
  };
}

contextRouter.use(requireAuth);

contextRouter.get("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedQuery = listContextQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json(badRequestFromZodError(parsedQuery.error));
  }

  const q = parsedQuery.data.q ?? "";
  const status = parsedQuery.data.status;
  const page = parsedQuery.data.page ?? 1;
  const pageSize = parsedQuery.data.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.ContextDocumentWhereInput = { teamId: auth.teamId };
  if (!isAdminOrOwner(auth.role)) {
    where.OR = [{ visibility: "PUBLIC" }, { ownerId: auth.userId }];
  }
  if (status) {
    where.status = status;
  }
  if (q) {
    const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [
      ...existingAnd,
      {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
          { body: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.contextDocument.findMany({
      where,
      select: {
        id: true,
        title: true,
        summary: true,
        body: true,
        status: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.contextDocument.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return res.status(200).json({
    data: rows.map((row) => serializeContextDoc(row)),
    meta: { page, pageSize, total, totalPages },
  });
});

contextRouter.post("/", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedBody = createContextBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const { title, summary, body, visibility, status } = parsedBody.data;

  const doc = await prisma.contextDocument.create({
    data: {
      teamId: auth.teamId,
      ownerId: auth.userId,
      title: title.trim(),
      summary: summary?.trim() || null,
      body,
      visibility: visibility ?? "PUBLIC",
      status: status ?? "DRAFT",
    },
    include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
  });

  return res.status(201).json({ data: serializeContextDoc(doc) });
});

contextRouter.get("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const doc = await prisma.contextDocument.findFirst({
    where: { id: parsedParams.data.id, teamId: auth.teamId },
    include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
  });

  if (!doc) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }
  if (doc.visibility === "PRIVATE" && doc.ownerId !== auth.userId && !isAdminOrOwner(auth.role)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this document." } });
  }

  return res.status(200).json({ data: serializeContextDoc(doc) });
});

contextRouter.patch("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = updateContextBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const docId = parsedParams.data.id;
  const existing = await prisma.contextDocument.findFirst({ where: { id: docId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (existing.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this document." } });
  }

  const u = parsedBody.data;
  const updated = await prisma.contextDocument.update({
    where: { id: docId },
    data: {
      title: typeof u.title === "string" ? u.title.trim() : undefined,
      summary: typeof u.summary === "string" ? u.summary.trim() || null : undefined,
      body: typeof u.body === "string" ? u.body : undefined,
      visibility: u.visibility,
      status: u.status,
    },
    include: { owner: { select: { id: true, name: true, avatarUrl: true } } },
  });

  return res.status(200).json({ data: serializeContextDoc(updated) });
});

contextRouter.delete("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const docId = parsedParams.data.id;
  const existing = await prisma.contextDocument.findFirst({ where: { id: docId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (existing.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can archive this document." } });
  }

  const archived = await prisma.contextDocument.update({
    where: { id: docId },
    data: { status: "ARCHIVED" },
  });

  return res.status(200).json({ data: archived });
});

export { contextRouter };
