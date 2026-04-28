import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth, requireOnboardingComplete } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const usersRouter = Router();
usersRouter.use(requireAuth);
usersRouter.use(requireOnboardingComplete);

const userIdParamsSchema = z.object({
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

usersRouter.get("/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = userIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const id = parsedParams.data.id;

  const user = await prisma.user.findFirst({
    where: { id, teamId: auth.teamId },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      ou: true,
      region: true,
      title: true,
    },
  });

  if (!user) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
  }

  const [collectionAddsCount, favoriteCount, favoritedByMe] = await Promise.all([
    prisma.collectionUser.count({
      where: {
        userId: id,
        collection: { teamId: auth.teamId },
      },
    }),
    prisma.userProfileFavorite.count({
      where: { targetUserId: id },
    }),
    prisma.userProfileFavorite.findUnique({
      where: {
        fanUserId_targetUserId: {
          fanUserId: auth.userId,
          targetUserId: id,
        },
      },
      select: { id: true },
    }),
  ]);

  return res.status(200).json({
    data: {
      ...user,
      collectionAddsCount,
      favoriteCount,
      favoritedByMe: Boolean(favoritedByMe),
    },
  });
});

usersRouter.post("/:id/favorite", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsedParams = userIdParamsSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json(badRequestFromZodError(parsedParams.error));
  }
  const id = parsedParams.data.id;

  if (id === auth.userId) {
    return res.status(400).json({
      error: { code: "BAD_REQUEST", message: "You cannot favorite your own profile." },
    });
  }

  const target = await prisma.user.findFirst({
    where: { id, teamId: auth.teamId },
    select: { id: true },
  });
  if (!target) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
  }

  const existing = await prisma.userProfileFavorite.findUnique({
    where: {
      fanUserId_targetUserId: {
        fanUserId: auth.userId,
        targetUserId: id,
      },
    },
  });

  if (existing) {
    await prisma.userProfileFavorite.delete({
      where: {
        fanUserId_targetUserId: {
          fanUserId: auth.userId,
          targetUserId: id,
        },
      },
    });
    return res.status(200).json({ data: { favorited: false } });
  }

  await prisma.userProfileFavorite.create({
    data: {
      fanUserId: auth.userId,
      targetUserId: id,
    },
  });
  return res.status(200).json({ data: { favorited: true } });
});

export { usersRouter };
