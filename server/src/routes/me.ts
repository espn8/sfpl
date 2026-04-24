/**
 * "Me" endpoints: authenticated-user-scoped helpers used by the Settings and
 * governance surfaces in the client.
 *
 * Currently exposes:
 *   - GET /api/me/assets/needs-verification?window=7
 *     Returns the caller's published assets whose verification is due within
 *     the given window (or already overdue). Used by the My Assets settings
 *     tab and the home-page owner reminder banner.
 */

import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const meRouter = Router();
meRouter.use(requireAuth);

const needsVerificationQuerySchema = z.object({
  window: z.coerce.number().int().positive().max(60).optional(),
});

type VerifiableRow = {
  id: number;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  verificationDueAt: Date | null;
  warningSentAt: Date | null;
  lastVerifiedAt: Date | null;
};

meRouter.get("/assets/needs-verification", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }
  const parsed = needsVerificationQuerySchema.safeParse(req.query);
  const windowDays = parsed.success ? parsed.data.window ?? 7 : 7;
  const now = new Date();
  const cutoff = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  const [prompts, skills, contexts, builds] = await Promise.all([
    prisma.prompt.findMany({
      where: { ownerId: auth.userId, status: "PUBLISHED", verificationDueAt: { not: null, lte: cutoff } },
      select: { id: true, title: true, status: true, verificationDueAt: true, warningSentAt: true, lastVerifiedAt: true },
      orderBy: { verificationDueAt: "asc" },
    }),
    prisma.skill.findMany({
      where: { ownerId: auth.userId, status: "PUBLISHED", verificationDueAt: { not: null, lte: cutoff } },
      select: { id: true, title: true, status: true, verificationDueAt: true, warningSentAt: true, lastVerifiedAt: true },
      orderBy: { verificationDueAt: "asc" },
    }),
    prisma.contextDocument.findMany({
      where: { ownerId: auth.userId, status: "PUBLISHED", verificationDueAt: { not: null, lte: cutoff } },
      select: { id: true, title: true, status: true, verificationDueAt: true, warningSentAt: true, lastVerifiedAt: true },
      orderBy: { verificationDueAt: "asc" },
    }),
    prisma.build.findMany({
      where: { ownerId: auth.userId, status: "PUBLISHED", verificationDueAt: { not: null, lte: cutoff } },
      select: { id: true, title: true, status: true, verificationDueAt: true, warningSentAt: true, lastVerifiedAt: true },
      orderBy: { verificationDueAt: "asc" },
    }),
  ]);

  const overdue = (row: VerifiableRow) => row.verificationDueAt !== null && row.verificationDueAt.getTime() < now.getTime();

  return res.status(200).json({
    data: {
      window: windowDays,
      prompts: prompts.map((r) => ({ ...r, overdue: overdue(r) })),
      skills: skills.map((r) => ({ ...r, overdue: overdue(r) })),
      contexts: contexts.map((r) => ({ ...r, overdue: overdue(r) })),
      builds: builds.map((r) => ({ ...r, overdue: overdue(r) })),
      totals: {
        total: prompts.length + skills.length + contexts.length + builds.length,
        overdue: [...prompts, ...skills, ...contexts, ...builds].filter(overdue).length,
      },
    },
  });
});

export { meRouter };
