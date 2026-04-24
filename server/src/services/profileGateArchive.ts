import { ArchiveReason, AssetType, VerificationAction } from "@prisma/client";
import { prisma } from "../lib/prisma";

/** Archives all PUBLISHED prompts/skills/context/builds for ownerId and writes AssetVerification rows. Idempotent for already-archived rows. */
export async function archivePublishedAssetsForProfileGate(ownerId: number): Promise<void> {
  const now = new Date();
  const reason = ArchiveReason.PROFILE_INCOMPLETE;

  await prisma.$transaction(async (tx) => {
    const prompts = await tx.prompt.findMany({
      where: { ownerId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (prompts.length > 0) {
      const ids = prompts.map((p) => p.id);
      await tx.prompt.updateMany({
        where: { id: { in: ids } },
        data: { status: "ARCHIVED", archivedAt: now, archiveReason: reason },
      });
      await tx.assetVerification.createMany({
        data: ids.map((assetId) => ({
          assetType: AssetType.PROMPT,
          assetId,
          userId: ownerId,
          action: VerificationAction.ARCHIVED,
          reason,
        })),
      });
    }

    const skills = await tx.skill.findMany({
      where: { ownerId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (skills.length > 0) {
      const ids = skills.map((s) => s.id);
      await tx.skill.updateMany({
        where: { id: { in: ids } },
        data: { status: "ARCHIVED", archivedAt: now, archiveReason: reason },
      });
      await tx.assetVerification.createMany({
        data: ids.map((assetId) => ({
          assetType: AssetType.SKILL,
          assetId,
          userId: ownerId,
          action: VerificationAction.ARCHIVED,
          reason,
        })),
      });
    }

    const contexts = await tx.contextDocument.findMany({
      where: { ownerId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (contexts.length > 0) {
      const ids = contexts.map((c) => c.id);
      await tx.contextDocument.updateMany({
        where: { id: { in: ids } },
        data: { status: "ARCHIVED", archivedAt: now, archiveReason: reason },
      });
      await tx.assetVerification.createMany({
        data: ids.map((assetId) => ({
          assetType: AssetType.CONTEXT,
          assetId,
          userId: ownerId,
          action: VerificationAction.ARCHIVED,
          reason,
        })),
      });
    }

    const builds = await tx.build.findMany({
      where: { ownerId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (builds.length > 0) {
      const ids = builds.map((b) => b.id);
      await tx.build.updateMany({
        where: { id: { in: ids } },
        data: { status: "ARCHIVED", archivedAt: now, archiveReason: reason },
      });
      await tx.assetVerification.createMany({
        data: ids.map((assetId) => ({
          assetType: AssetType.BUILD,
          assetId,
          userId: ownerId,
          action: VerificationAction.ARCHIVED,
          reason,
        })),
      });
    }
  });
}
