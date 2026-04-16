import type { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const contextRouter = Router();

const promptVisibilitySchema = z.enum(["PUBLIC", "TEAM", "PRIVATE"]);
const promptStatusSchema = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

const CONTEXT_TOOLS = ["claude_code", "cursor", "gemini", "meshmesh", "notebooklm", "other", "saleo", "slackbot"] as const;
const contextToolSchema = z.enum(CONTEXT_TOOLS);

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

function canAccessByVisibility(
  item: { visibility: string; ownerId: number; owner?: { ou: string | null } | null },
  auth: { userId: number; userOu: string | null; role: string },
): boolean {
  if (item.visibility === "PUBLIC") {
    return true;
  }
  if (item.ownerId === auth.userId) {
    return true;
  }
  if (isAdminOrOwner(auth.role)) {
    return true;
  }
  if (item.visibility === "TEAM" && auth.userOu && item.owner?.ou === auth.userOu) {
    return true;
  }
  return false;
}

const listContextQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: promptStatusSchema.optional(),
  mine: z.coerce.boolean().optional(),
  includeAnalytics: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const contextIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const usageBodySchema = z.object({
  eventType: z.enum(["VIEW", "COPY"]),
});

const contextVariableItemSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "variable key is required.")
    .max(64, "variable key is too long.")
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "variable key must start with a letter and use letters, numbers, or underscores."),
  label: z.string().trim().max(200).optional().nullable(),
  defaultValue: z.string().max(20000).optional().nullable(),
  required: z.boolean().optional(),
});

const replaceContextVariablesBodySchema = z
  .object({
    variables: z.array(contextVariableItemSchema).max(40, "too many variables."),
  })
  .superRefine((value, ctx) => {
    const keys = value.variables.map((item) => item.key);
    const seen = new Set<string>();
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate variable key: ${key}.`,
          path: ["variables", index, "key"],
        });
        return;
      }
      seen.add(key);
    }
  });

const createContextBodySchema = z
  .object({
    title: z.string().trim().min(1, "title is required."),
    summary: z.string().trim().optional(),
    body: z.string().min(1, "body is required.").max(MAX_BODY_LENGTH, "body is too long."),
    visibility: promptVisibilitySchema.optional(),
    status: promptStatusSchema.optional(),
    tools: z.array(z.union([contextToolSchema, z.string()])).optional(),
    variables: z.array(contextVariableItemSchema).max(40).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.variables?.length) {
      return;
    }
    const seen = new Set<string>();
    for (let index = 0; index < value.variables.length; index += 1) {
      const key = value.variables[index].key;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate variable key: ${key}.`,
          path: ["variables", index, "key"],
        });
        return;
      }
      seen.add(key);
    }
  });

const updateContextBodySchema = z
  .object({
    title: z.string().trim().optional(),
    summary: z.string().trim().optional(),
    body: z.string().min(1).max(MAX_BODY_LENGTH, "body is too long.").optional(),
    visibility: promptVisibilitySchema.optional(),
    status: promptStatusSchema.optional(),
    tools: z.array(z.union([contextToolSchema, z.string()])).optional(),
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
  const mine = parsedQuery.data.mine ?? false;
  const includeAnalytics = parsedQuery.data.includeAnalytics ?? false;
  const page = parsedQuery.data.page ?? 1;
  const pageSize = parsedQuery.data.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Prisma.ContextDocumentWhereInput = { teamId: auth.teamId };
  if (mine) {
    where.ownerId = auth.userId;
  } else if (!isAdminOrOwner(auth.role)) {
    const visibilityConditions: Prisma.ContextDocumentWhereInput[] = [
      { visibility: "PUBLIC" },
      { ownerId: auth.userId },
    ];
    if (auth.userOu) {
      visibilityConditions.push({
        visibility: "TEAM",
        owner: { ou: auth.userOu },
      });
    }
    where.OR = visibilityConditions;
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
        tools: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, avatarUrl: true } },
        variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.contextDocument.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (includeAnalytics && rows.length > 0) {
    const contextIds = rows.map((r) => r.id);
    const [viewCounts, copyCounts, favoriteCounts] = await Promise.all([
      prisma.contextUsageEvent.groupBy({
        by: ["contextId"],
        where: { contextId: { in: contextIds }, eventType: "VIEW" },
        _count: { contextId: true },
      }),
      prisma.contextUsageEvent.groupBy({
        by: ["contextId"],
        where: { contextId: { in: contextIds }, eventType: "COPY" },
        _count: { contextId: true },
      }),
      prisma.contextFavorite.groupBy({
        by: ["contextId"],
        where: { contextId: { in: contextIds } },
        _count: { contextId: true },
      }),
    ]);

    const viewMap = new Map(viewCounts.map((v) => [v.contextId, v._count.contextId]));
    const copyMap = new Map(copyCounts.map((c) => [c.contextId, c._count.contextId]));
    const favoriteMap = new Map(favoriteCounts.map((f) => [f.contextId, f._count.contextId]));

    const dataWithAnalytics = rows.map((row) => ({
      ...serializeContextDoc(row),
      viewCount: viewMap.get(row.id) ?? 0,
      copyCount: copyMap.get(row.id) ?? 0,
      favoriteCount: favoriteMap.get(row.id) ?? 0,
    }));

    return res.status(200).json({
      data: dataWithAnalytics,
      meta: { page, pageSize, total, totalPages },
    });
  }

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

  const { title, summary, body, visibility, status, tools, variables } = parsedBody.data;

  const doc = await prisma.contextDocument.create({
    data: {
      teamId: auth.teamId,
      ownerId: auth.userId,
      title: title.trim(),
      summary: summary?.trim() || null,
      body,
      visibility: visibility ?? "PUBLIC",
      status: status ?? "DRAFT",
      tools: tools ?? [],
      variables:
        variables && variables.length > 0
          ? {
              create: variables.map((item) => ({
                key: item.key.trim(),
                label: item.label?.trim() || null,
                defaultValue: typeof item.defaultValue === "string" ? item.defaultValue : null,
                required: item.required ?? false,
              })),
            }
          : undefined,
    },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
    },
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

  const contextId = parsedParams.data.id;
  const doc = await prisma.contextDocument.findFirst({
    where: { id: contextId, teamId: auth.teamId },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true, ou: true } },
      variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
    },
  });

  if (!doc) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }
  if (!canAccessByVisibility(doc, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this document." } });
  }

  const [viewCount, favoriteRow] = await Promise.all([
    prisma.contextUsageEvent.count({ where: { contextId, eventType: "VIEW" } }),
    prisma.contextFavorite.findUnique({ where: { contextId_userId: { contextId, userId: auth.userId } } }),
  ]);

  return res.status(200).json({
    data: {
      ...serializeContextDoc(doc),
      viewCount,
      favorited: Boolean(favoriteRow),
    },
  });
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
      tools: u.tools,
    },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true } },
      variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
    },
  });

  return res.status(200).json({ data: serializeContextDoc(updated) });
});

contextRouter.put("/:id/variables", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const parsedBody = replaceContextVariablesBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const contextId = parsedParams.data.id;
  const existing = await prisma.contextDocument.findFirst({ where: { id: contextId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (existing.ownerId !== auth.userId && auth.role !== "OWNER" && auth.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only owner/admin can modify this document." } });
  }

  const rows = parsedBody.data.variables.map((item) => ({
    contextId,
    key: item.key.trim(),
    label: item.label?.trim() || null,
    defaultValue: typeof item.defaultValue === "string" ? item.defaultValue : null,
    required: item.required ?? false,
  }));

  const transactionSteps = [prisma.contextVariable.deleteMany({ where: { contextId } })];
  if (rows.length > 0) {
    transactionSteps.push(prisma.contextVariable.createMany({ data: rows }));
  }
  await prisma.$transaction(transactionSteps);

  const doc = await prisma.contextDocument.findFirst({
    where: { id: contextId, teamId: auth.teamId },
    include: {
      owner: { select: { id: true, name: true, avatarUrl: true, ou: true } },
      variables: { select: { id: true, key: true, label: true, defaultValue: true, required: true } },
    },
  });

  if (!doc) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }
  if (!canAccessByVisibility(doc, auth)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this document." } });
  }

  return res.status(200).json({ data: serializeContextDoc(doc) });
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

contextRouter.delete("/:id/permanent", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const contextId = parsedParams.data.id;
  const existing = await prisma.contextDocument.findFirst({ where: { id: contextId, teamId: auth.teamId } });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  if (existing.ownerId !== auth.userId) {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Only the owner can permanently delete this context file." },
    });
  }

  await prisma.$transaction([
    prisma.contextUsageEvent.deleteMany({ where: { contextId } }),
    prisma.contextFavorite.deleteMany({ where: { contextId } }),
    prisma.contextVariable.deleteMany({ where: { contextId } }),
    prisma.contextDocument.delete({ where: { id: contextId } }),
  ]);

  return res.status(200).json({ data: { deleted: true, id: contextId } });
});

contextRouter.post("/:id/favorite", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const contextId = parsedParams.data.id;
  const doc = await prisma.contextDocument.findFirst({ where: { id: contextId, teamId: auth.teamId } });
  if (!doc) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  const existing = await prisma.contextFavorite.findUnique({
    where: { contextId_userId: { contextId, userId: auth.userId } },
  });
  if (existing) {
    await prisma.contextFavorite.delete({ where: { contextId_userId: { contextId, userId: auth.userId } } });
    return res.status(200).json({ data: { favorited: false } });
  }
  await prisma.contextFavorite.create({ data: { contextId, userId: auth.userId } });
  return res.status(200).json({ data: { favorited: true } });
});

contextRouter.post("/:id/usage", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = contextIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }

  const parsedBody = usageBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json(badRequestFromZodError(parsedBody.error));
  }

  const contextId = parsedParams.data.id;
  const { eventType } = parsedBody.data;

  const doc = await prisma.contextDocument.findFirst({ where: { id: contextId, teamId: auth.teamId } });
  if (!doc) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Context document not found." } });
  }

  await prisma.contextUsageEvent.create({ data: { contextId, userId: auth.userId, eventType } });
  return res.status(200).json({ data: { ok: true } });
});

export { contextRouter };
