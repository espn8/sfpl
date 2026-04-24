/**
 * Admin-only routes for the governance/ownership tooling. Gated behind
 * `requireRole(["OWNER", "ADMIN"])` so member/viewer accounts get 403.
 *
 * Endpoints:
 *   - GET  /api/admin/users/:userId/assets
 *     Lists every prompt/skill/context/build owned by the target user (same
 *     team as the caller). Backs the admin "transfer ownership" UI.
 *   - POST /api/admin/users/:userId/transfer-assets
 *     Bulk-reassigns ownership of every asset owned by `userId` to
 *     `newOwnerId`. Used when a teammate leaves the business.
 *   - POST /api/admin/governance/run
 *     Manually triggers the governance sweep; useful for staging/ops.
 */

import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth, requireRole } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { runGovernanceSweepWithGate } from "../jobs/governance";
import { transferOwner } from "../services/governanceOps";

const adminRouter = Router();
adminRouter.use(requireAuth);
adminRouter.use(requireRole(["OWNER", "ADMIN"]));

const userIdParamsSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

const transferAssetsBodySchema = z.object({
  newOwnerId: z.number().int().positive(),
  includeStatuses: z.array(z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"])).optional(),
  assetTypes: z.array(z.enum(["PROMPT", "SKILL", "CONTEXT", "BUILD"])).optional(),
  reason: z.string().trim().max(500).optional(),
});

adminRouter.get("/users", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const qSchema = z.object({ q: z.string().trim().max(100).optional() });
  const parsed = qSchema.safeParse(req.query);
  const q = parsed.success ? parsed.data.q : undefined;
  const users = await prisma.user.findMany({
    where: {
      teamId: auth.teamId,
      ...(q && q.length > 0
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, email: true, avatarUrl: true, role: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 100,
  });
  return res.status(200).json({ data: users });
});

adminRouter.get("/users/:userId/assets", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsed = userIdParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid user id.", details: parsed.error.issues } });
  }
  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, name: true, email: true, teamId: true, role: true },
  });
  if (!target || target.teamId !== auth.teamId) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found on this team." } });
  }

  const [prompts, skills, contexts, builds] = await Promise.all([
    prisma.prompt.findMany({
      where: { ownerId: target.id },
      select: { id: true, title: true, status: true, updatedAt: true, verificationDueAt: true, archivedAt: true, archiveReason: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.skill.findMany({
      where: { ownerId: target.id },
      select: { id: true, title: true, status: true, updatedAt: true, verificationDueAt: true, archivedAt: true, archiveReason: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.contextDocument.findMany({
      where: { ownerId: target.id },
      select: { id: true, title: true, status: true, updatedAt: true, verificationDueAt: true, archivedAt: true, archiveReason: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.build.findMany({
      where: { ownerId: target.id },
      select: { id: true, title: true, status: true, updatedAt: true, verificationDueAt: true, archivedAt: true, archiveReason: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return res.status(200).json({
    data: {
      user: target,
      prompts,
      skills,
      contexts,
      builds,
      totals: {
        prompts: prompts.length,
        skills: skills.length,
        contexts: contexts.length,
        builds: builds.length,
        total: prompts.length + skills.length + contexts.length + builds.length,
      },
    },
  });
});

adminRouter.post("/users/:userId/transfer-assets", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsedParams = userIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid user id.", details: parsedParams.error.issues } });
  }
  const parsedBody = transferAssetsBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid request body.", details: parsedBody.error.issues } });
  }
  const { newOwnerId, includeStatuses, assetTypes, reason } = parsedBody.data;

  const [from, to] = await Promise.all([
    prisma.user.findUnique({ where: { id: parsedParams.data.userId }, select: { id: true, teamId: true } }),
    prisma.user.findUnique({ where: { id: newOwnerId }, select: { id: true, teamId: true } }),
  ]);
  if (!from || from.teamId !== auth.teamId) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Source user not found on this team." } });
  }
  if (!to || to.teamId !== auth.teamId) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "New owner must be on the same team." } });
  }
  if (from.id === to.id) {
    return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Source and destination must differ." } });
  }

  const kinds = (assetTypes ?? ["PROMPT", "SKILL", "CONTEXT", "BUILD"]) as Array<"PROMPT" | "SKILL" | "CONTEXT" | "BUILD">;
  const statusFilter = includeStatuses && includeStatuses.length > 0 ? { status: { in: includeStatuses } } : {};
  const counts = { PROMPT: 0, SKILL: 0, CONTEXT: 0, BUILD: 0 } as Record<typeof kinds[number], number>;

  if (kinds.includes("PROMPT")) {
    const ids = (await prisma.prompt.findMany({ where: { ownerId: from.id, ...statusFilter }, select: { id: true } })).map((x) => x.id);
    for (const id of ids) {
      await transferOwner("PROMPT", id, auth.userId, to.id, reason ?? `Bulk transfer from user ${from.id} to user ${to.id}.`);
    }
    counts.PROMPT = ids.length;
  }
  if (kinds.includes("SKILL")) {
    const ids = (await prisma.skill.findMany({ where: { ownerId: from.id, ...statusFilter }, select: { id: true } })).map((x) => x.id);
    for (const id of ids) {
      await transferOwner("SKILL", id, auth.userId, to.id, reason ?? `Bulk transfer from user ${from.id} to user ${to.id}.`);
    }
    counts.SKILL = ids.length;
  }
  if (kinds.includes("CONTEXT")) {
    const ids = (await prisma.contextDocument.findMany({ where: { ownerId: from.id, ...statusFilter }, select: { id: true } })).map((x) => x.id);
    for (const id of ids) {
      await transferOwner("CONTEXT", id, auth.userId, to.id, reason ?? `Bulk transfer from user ${from.id} to user ${to.id}.`);
    }
    counts.CONTEXT = ids.length;
  }
  if (kinds.includes("BUILD")) {
    const ids = (await prisma.build.findMany({ where: { ownerId: from.id, ...statusFilter }, select: { id: true } })).map((x) => x.id);
    for (const id of ids) {
      await transferOwner("BUILD", id, auth.userId, to.id, reason ?? `Bulk transfer from user ${from.id} to user ${to.id}.`);
    }
    counts.BUILD = ids.length;
  }

  return res.status(200).json({
    data: {
      fromUserId: from.id,
      toUserId: to.id,
      transferred: counts,
      total: counts.PROMPT + counts.SKILL + counts.CONTEXT + counts.BUILD,
    },
  });
});

const governanceRunQuerySchema = z.object({
  dryRun: z.coerce.boolean().optional(),
});

adminRouter.post("/governance/run", async (req: Request, res: Response) => {
  const parsed = governanceRunQuerySchema.safeParse(req.query);
  const dryRun = parsed.success ? parsed.data.dryRun ?? false : false;
  const result = await runGovernanceSweepWithGate({ dryRun });
  return res.status(200).json({ data: result });
});

export { adminRouter };
