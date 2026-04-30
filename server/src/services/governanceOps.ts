/**
 * Shared helpers used by asset routes to perform per-asset governance actions:
 *   - verify (owner keeps their asset live for another 30 days)
 *   - unarchive (owner restores an auto-archived asset)
 *   - transferOwner (admin reassigns an asset, e.g. when a user leaves)
 *
 * Each helper writes an `AssetVerification` audit row so we can explain to
 * users later why an asset is in its current state.
 */

import type { ArchiveReason, AssetType, PromptStatus, VerificationAction } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { firstPublishedAtOnTransition } from "../lib/firstPublishedAt";

const VERIFICATION_WINDOW_DAYS = 30;

export type AssetKind = Extract<AssetType, "PROMPT" | "SKILL" | "CONTEXT" | "BUILD">;

function delegateFor(kind: AssetKind) {
  switch (kind) {
    case "PROMPT":
      return prisma.prompt;
    case "SKILL":
      return prisma.skill;
    case "CONTEXT":
      return prisma.contextDocument;
    case "BUILD":
      return prisma.build;
  }
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function logVerification(input: {
  kind: AssetKind;
  assetId: number;
  userId: number;
  action: VerificationAction;
  reason?: ArchiveReason | null;
  notes?: string | null;
}): Promise<void> {
  await prisma.assetVerification.create({
    data: {
      assetType: input.kind,
      assetId: input.assetId,
      userId: input.userId,
      action: input.action,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
    },
  });
}

/** Mark an asset as verified-by-owner: pushes dueAt out by 30 days and clears the warning timestamp. */
export async function verifyAsset(kind: AssetKind, assetId: number, userId: number): Promise<void> {
  const now = new Date();
  const due = addDays(now, VERIFICATION_WINDOW_DAYS);
  const delegate = delegateFor(kind) as unknown as {
    update: (args: unknown) => Promise<unknown>;
  };
  await delegate.update({
    where: { id: assetId },
    data: {
      lastVerifiedAt: now,
      verificationDueAt: due,
      warningSentAt: null,
    },
  });
  await logVerification({ kind, assetId, userId, action: "VERIFIED" });
}

/** Unarchive and re-verify in one step. */
export async function unarchiveAsset(kind: AssetKind, assetId: number, userId: number): Promise<void> {
  const now = new Date();
  const due = addDays(now, VERIFICATION_WINDOW_DAYS);

  const select = { status: true as const, publishedAt: true as const };
  const existing =
    kind === "PROMPT"
      ? await prisma.prompt.findUnique({ where: { id: assetId }, select })
      : kind === "SKILL"
        ? await prisma.skill.findUnique({ where: { id: assetId }, select })
        : kind === "CONTEXT"
          ? await prisma.contextDocument.findUnique({ where: { id: assetId }, select })
          : await prisma.build.findUnique({ where: { id: assetId }, select });
  if (!existing) {
    return;
  }
  const publishPatch = firstPublishedAtOnTransition(
    existing.status as PromptStatus,
    existing.publishedAt,
    "PUBLISHED",
  );

  const delegate = delegateFor(kind) as unknown as {
    update: (args: unknown) => Promise<unknown>;
  };
  await delegate.update({
    where: { id: assetId },
    data: {
      status: "PUBLISHED",
      archivedAt: null,
      archiveReason: null,
      lastVerifiedAt: now,
      verificationDueAt: due,
      warningSentAt: null,
      ...publishPatch,
    },
  });
  await logVerification({ kind, assetId, userId, action: "UNARCHIVED" });
}

/** Reassign asset ownership (admin-only). Caller is expected to have validated
 * admin role and same-team membership of `newOwnerId`. */
export async function transferOwner(
  kind: AssetKind,
  assetId: number,
  actingUserId: number,
  newOwnerId: number,
  notes?: string,
): Promise<void> {
  const delegate = delegateFor(kind) as unknown as {
    update: (args: unknown) => Promise<unknown>;
  };
  await delegate.update({
    where: { id: assetId },
    data: { ownerId: newOwnerId },
  });
  await logVerification({
    kind,
    assetId,
    userId: actingUserId,
    action: "OWNERSHIP_TRANSFERRED",
    notes: notes ?? `Ownership transferred to user ${newOwnerId}.`,
  });
}

/** Manual archive via asset routes (DELETE endpoint). Keeps governance audit
 * consistent with automated archives by writing an AssetVerification row. */
export async function logManualArchive(kind: AssetKind, assetId: number, userId: number): Promise<void> {
  const now = new Date();
  const delegate = delegateFor(kind) as unknown as {
    update: (args: unknown) => Promise<unknown>;
  };
  await delegate.update({
    where: { id: assetId },
    data: { archivedAt: now, archiveReason: "MANUAL" },
  });
  await logVerification({ kind, assetId, userId, action: "ARCHIVED", reason: "MANUAL" });
}
