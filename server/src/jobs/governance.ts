import {
  ArchiveReason,
  AssetType,
  Prisma,
  VerificationAction,
} from "@prisma/client";
import { env } from "../config/env";
import { sendBrandedEmail, escapeHtml } from "../lib/email";
import { prisma } from "../lib/prisma";
import { computeTopScored, type AssetKind } from "../services/scoring";

const DAY_MS = 1000 * 60 * 60 * 24;
const WARNING_WINDOW_DAYS = 7;
const INACTIVITY_DAYS = 30;
const LOW_RATING_MIN_COUNT = 10;
const LOW_RATING_THRESHOLD = 2; // raw average strictly below this triggers archival.
const SMART_PICK_TOP_N = 12;

/** Set at the start of `runGovernanceSweep` / `recomputeSmartPicks` so warn queries use the same clock as tests. */
let governanceSweepClock: Date = new Date();

function governanceNow(): Date {
  return governanceSweepClock;
}

export type SweepCounts = {
  warningsSent: number;
  archivedUnverified: number;
  archivedInactive: number;
  archivedLowRating: number;
};

export type AssetTypeSweepResult = SweepCounts & { assetType: AssetType };

export type SweepResult = {
  byAssetType: Record<AssetType, AssetTypeSweepResult>;
  totals: SweepCounts;
  smartPicksRecomputed: number;
  startedAt: Date;
  finishedAt: Date;
  dryRun: boolean;
};

type OwnerInfo = { id: number; email: string | null; name: string | null };

type AssetRow = {
  id: number;
  title: string;
  owner: OwnerInfo;
  verificationDueAt: Date | null;
  updatedAt: Date;
};

type AssetConfig = {
  assetType: AssetType;
  typeLabel: string;
  /** Path segment used in the verify/unarchive UI URL. */
  urlSegment: "prompts" | "skills" | "context" | "builds";
  /**
   * Returns the set of assets in scope for the sweep. The implementation
   * performs filtering and emits minimal fields required by the sweep phases.
   */
  findPublishedWithDueWithin: (until: Date) => Promise<AssetRow[]>;
  findOverdue: (now: Date) => Promise<AssetRow[]>;
  findInactive: (cutoff: Date) => Promise<AssetRow[]>;
  findLowRated: (minCount: number, threshold: number) => Promise<AssetRow[]>;
  markWarning: (id: number, at: Date) => Promise<void>;
  archive: (id: number, reason: ArchiveReason, at: Date) => Promise<void>;
  /** IDs of assets currently flagged as `isSmartPick = true`, used when
   * diffing against the newly computed top N in `recomputeSmartPicks`. */
  listCurrentSmartPicks: () => Promise<number[]>;
  setSmartPick: (ids: number[], value: boolean) => Promise<void>;
};

function verifyUrlFor(segment: AssetConfig["urlSegment"], id: number): string {
  const base = env.appBaseUrl.replace(/\/+$/, "");
  return `${base}/${segment}/${id}`;
}

function myAssetsUrl(): string {
  const base = env.appBaseUrl.replace(/\/+$/, "");
  return `${base}/settings/my-assets`;
}

async function writeAudit(
  tx: Prisma.TransactionClient | typeof prisma,
  assetType: AssetType,
  assetId: number,
  userId: number,
  action: VerificationAction,
  reason: ArchiveReason | null,
  notes: string | null,
): Promise<void> {
  await tx.assetVerification.create({
    data: {
      assetType,
      assetId,
      userId,
      action,
      reason: reason ?? undefined,
      notes: notes ?? undefined,
    },
  });
}

function formatDays(msUntil: number): string {
  const days = Math.max(0, Math.round(msUntil / DAY_MS));
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

async function sendWarningEmail(
  asset: AssetRow,
  typeLabel: string,
  urlSegment: AssetConfig["urlSegment"],
  dueAt: Date,
): Promise<void> {
  if (!asset.owner.email) return;
  const daysLeft = formatDays(dueAt.getTime() - Date.now());
  const assetUrl = verifyUrlFor(urlSegment, asset.id);
  const myAssets = myAssetsUrl();

  const html = `
    <h1 style="margin:0 0 8px 0;font-size:22px;line-height:28px;font-weight:700;color:#032d60;">
      Your ${escapeHtml(typeLabel)} needs a quick check-in
    </h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:22px;color:#032d60;">
      Hi ${escapeHtml(asset.owner.name ?? "there")},
    </p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:22px;color:#032d60;">
      <strong>${escapeHtml(asset.title)}</strong> is due for verification in ${escapeHtml(daysLeft)}.
      If it's still useful, please confirm — otherwise we'll auto-archive it to keep the library clean.
    </p>
    <p style="margin:0 0 16px 0;">
      <a href="${escapeHtml(assetUrl)}"
         class="email-button"
         style="background-color:#2e844a;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 24px;display:inline-block;font-weight:600;">
        Verify now
      </a>
    </p>
    <p style="margin:0 0 0 0;font-size:13px;line-height:20px;color:#51678d;">
      Manage all your assets any time: <a href="${escapeHtml(myAssets)}" style="color:#0176d3;text-decoration:underline;">My Assets</a>
    </p>
  `;

  const text = `Your ${typeLabel} "${asset.title}" is due for verification in ${daysLeft}.
Verify: ${assetUrl}
Manage all your assets: ${myAssets}`;

  try {
    await sendBrandedEmail({
      to: asset.owner.email,
      subject: `Please verify: ${asset.title}`,
      preheader: `Due in ${daysLeft}`,
      html,
      text,
    });
  } catch (error) {
    console.error("[governance] warning email failed:", error);
  }
}

async function sendArchivedEmail(
  asset: AssetRow,
  typeLabel: string,
  urlSegment: AssetConfig["urlSegment"],
  reason: ArchiveReason,
): Promise<void> {
  if (!asset.owner.email) return;
  const reasonLabel: Record<ArchiveReason, string> = {
    MANUAL: "archived manually",
    UNVERIFIED: "wasn't verified in time",
    INACTIVE: "had no usage in the last 30 days",
    LOW_RATING: "fell below the team's quality threshold",
    PROFILE_INCOMPLETE: "was published before profile setup was completed",
  };

  const assetUrl = verifyUrlFor(urlSegment, asset.id);
  const html = `
    <h1 style="margin:0 0 8px 0;font-size:22px;line-height:28px;font-weight:700;color:#032d60;">
      ${escapeHtml(asset.title)} was archived
    </h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:22px;color:#032d60;">
      Your ${escapeHtml(typeLabel)} <strong>${escapeHtml(asset.title)}</strong> ${escapeHtml(reasonLabel[reason])}.
      If this was a mistake, you can unarchive and reset its verification window in one click.
    </p>
    <p style="margin:0 0 16px 0;">
      <a href="${escapeHtml(assetUrl)}"
         class="email-button"
         style="background-color:#2e844a;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 24px;display:inline-block;font-weight:600;">
        Review & unarchive
      </a>
    </p>
  `;
  const text = `${asset.title} was archived (${reasonLabel[reason]}). Review: ${assetUrl}`;

  try {
    await sendBrandedEmail({
      to: asset.owner.email,
      subject: `Archived: ${asset.title}`,
      preheader: reasonLabel[reason],
      html,
      text,
    });
  } catch (error) {
    console.error("[governance] archive email failed:", error);
  }
}

function ownerSelect() {
  return {
    owner: { select: { id: true, email: true, name: true } },
  } as const;
}

const assetConfigs: AssetConfig[] = [
  {
    assetType: AssetType.PROMPT,
    typeLabel: "prompt",
    urlSegment: "prompts",
    findPublishedWithDueWithin: async (until) =>
      prisma.prompt.findMany({
        where: {
          status: "PUBLISHED",
          verificationDueAt: { gte: governanceNow(), lte: until },
          OR: [
            { warningSentAt: null },
            { warningSentAt: { lt: new Date(governanceNow().getTime() - 7 * DAY_MS) } },
          ],
        },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
        },
      }),
    findOverdue: async (now) =>
      prisma.prompt.findMany({
        where: {
          status: "PUBLISHED",
          verificationDueAt: { lt: now },
        },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
        },
      }),
    findInactive: async (cutoff) =>
      prisma.prompt.findMany({
        where: {
          status: "PUBLISHED",
          updatedAt: { lt: cutoff },
          usageEvents: { none: { createdAt: { gte: cutoff } } },
          ratings: { none: { updatedAt: { gte: cutoff } } },
        },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
        },
      }),
    findLowRated: async (minCount, threshold) => {
      const rows = await prisma.prompt.findMany({
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
          ratings: { select: { value: true } },
        },
      });
      return rows
        .filter((row) => (row.ratings ?? []).length >= minCount)
        .filter((row) => {
          const ratings = row.ratings ?? [];
          const avg = ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length;
          return avg < threshold;
        })
        .map(({ ratings: _ratings, ...rest }) => rest);
    },
    markWarning: async (id, at) => {
      await prisma.prompt.update({
        where: { id },
        data: { warningSentAt: at },
      });
    },
    archive: async (id, reason, at) => {
      await prisma.prompt.update({
        where: { id },
        data: { status: "ARCHIVED", archivedAt: at, archiveReason: reason },
      });
    },
    listCurrentSmartPicks: async () => {
      const rows = await prisma.prompt.findMany({
        where: { isSmartPick: true },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    },
    setSmartPick: async (ids, value) => {
      if (ids.length === 0) return;
      await prisma.prompt.updateMany({
        where: { id: { in: ids } },
        data: { isSmartPick: value },
      });
    },
  },
  {
    assetType: AssetType.SKILL,
    typeLabel: "skill",
    urlSegment: "skills",
    findPublishedWithDueWithin: async (until) =>
      prisma.skill.findMany({
        where: {
          status: "PUBLISHED",
          verificationDueAt: { gte: governanceNow(), lte: until },
          OR: [
            { warningSentAt: null },
            { warningSentAt: { lt: new Date(governanceNow().getTime() - 7 * DAY_MS) } },
          ],
        },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
        },
      }),
    findOverdue: async (now) =>
      prisma.skill.findMany({
        where: { status: "PUBLISHED", verificationDueAt: { lt: now } },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
        },
      }),
    findInactive: async (cutoff) =>
      prisma.skill.findMany({
        where: {
          status: "PUBLISHED",
          updatedAt: { lt: cutoff },
          usageEvents: { none: { createdAt: { gte: cutoff } } },
          ratings: { none: { updatedAt: { gte: cutoff } } },
        },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
        },
      }),
    findLowRated: async (minCount, threshold) => {
      const rows = await prisma.skill.findMany({
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
          ratings: { select: { value: true } },
        },
      });
      return rows
        .filter((row) => (row.ratings ?? []).length >= minCount)
        .filter((row) => {
          const ratings = row.ratings ?? [];
          const avg = ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length;
          return avg < threshold;
        })
        .map(({ ratings: _ratings, ...rest }) => rest);
    },
    markWarning: async (id, at) => {
      await prisma.skill.update({ where: { id }, data: { warningSentAt: at } });
    },
    archive: async (id, reason, at) => {
      await prisma.skill.update({
        where: { id },
        data: { status: "ARCHIVED", archivedAt: at, archiveReason: reason },
      });
    },
    listCurrentSmartPicks: async () => {
      const rows = await prisma.skill.findMany({
        where: { isSmartPick: true },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    },
    setSmartPick: async (ids, value) => {
      if (ids.length === 0) return;
      await prisma.skill.updateMany({
        where: { id: { in: ids } },
        data: { isSmartPick: value },
      });
    },
  },
  {
    assetType: AssetType.CONTEXT,
    typeLabel: "context doc",
    urlSegment: "context",
    findPublishedWithDueWithin: async (until) =>
      prisma.contextDocument.findMany({
        where: {
          status: "PUBLISHED",
          verificationDueAt: { gte: governanceNow(), lte: until },
          OR: [
            { warningSentAt: null },
            { warningSentAt: { lt: new Date(governanceNow().getTime() - 7 * DAY_MS) } },
          ],
        },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
        },
      }),
    findOverdue: async (now) =>
      prisma.contextDocument.findMany({
        where: { status: "PUBLISHED", verificationDueAt: { lt: now } },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
        },
      }),
    findInactive: async (cutoff) =>
      prisma.contextDocument.findMany({
        where: {
          status: "PUBLISHED",
          updatedAt: { lt: cutoff },
          usageEvents: { none: { createdAt: { gte: cutoff } } },
          ratings: { none: { updatedAt: { gte: cutoff } } },
        },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
        },
      }),
    findLowRated: async (minCount, threshold) => {
      const rows = await prisma.contextDocument.findMany({
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
          ratings: { select: { value: true } },
        },
      });
      return rows
        .filter((row) => (row.ratings ?? []).length >= minCount)
        .filter((row) => {
          const ratings = row.ratings ?? [];
          const avg = ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length;
          return avg < threshold;
        })
        .map(({ ratings: _ratings, ...rest }) => rest);
    },
    markWarning: async (id, at) => {
      await prisma.contextDocument.update({
        where: { id },
        data: { warningSentAt: at },
      });
    },
    archive: async (id, reason, at) => {
      await prisma.contextDocument.update({
        where: { id },
        data: { status: "ARCHIVED", archivedAt: at, archiveReason: reason },
      });
    },
    listCurrentSmartPicks: async () => {
      const rows = await prisma.contextDocument.findMany({
        where: { isSmartPick: true },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    },
    setSmartPick: async (ids, value) => {
      if (ids.length === 0) return;
      await prisma.contextDocument.updateMany({
        where: { id: { in: ids } },
        data: { isSmartPick: value },
      });
    },
  },
  {
    assetType: AssetType.BUILD,
    typeLabel: "build",
    urlSegment: "builds",
    findPublishedWithDueWithin: async (until) =>
      prisma.build.findMany({
        where: {
          status: "PUBLISHED",
          verificationDueAt: { gte: governanceNow(), lte: until },
          OR: [
            { warningSentAt: null },
            { warningSentAt: { lt: new Date(governanceNow().getTime() - 7 * DAY_MS) } },
          ],
        },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
        },
      }),
    findOverdue: async (now) =>
      prisma.build.findMany({
        where: { status: "PUBLISHED", verificationDueAt: { lt: now } },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
        },
      }),
    findInactive: async (cutoff) =>
      prisma.build.findMany({
        where: {
          status: "PUBLISHED",
          updatedAt: { lt: cutoff },
          usageEvents: { none: { createdAt: { gte: cutoff } } },
          ratings: { none: { updatedAt: { gte: cutoff } } },
        },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
        },
      }),
    findLowRated: async (minCount, threshold) => {
      const rows = await prisma.build.findMany({
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          title: true,
          verificationDueAt: true,
          updatedAt: true,
          ...ownerSelect(),
          ratings: { select: { value: true } },
        },
      });
      return rows
        .filter((row) => (row.ratings ?? []).length >= minCount)
        .filter((row) => {
          const ratings = row.ratings ?? [];
          const avg = ratings.reduce((sum, r) => sum + r.value, 0) / ratings.length;
          return avg < threshold;
        })
        .map(({ ratings: _ratings, ...rest }) => rest);
    },
    markWarning: async (id, at) => {
      await prisma.build.update({ where: { id }, data: { warningSentAt: at } });
    },
    archive: async (id, reason, at) => {
      await prisma.build.update({
        where: { id },
        data: { status: "ARCHIVED", archivedAt: at, archiveReason: reason },
      });
    },
    listCurrentSmartPicks: async () => {
      const rows = await prisma.build.findMany({
        where: { isSmartPick: true },
        select: { id: true },
      });
      return rows.map((r) => r.id);
    },
    setSmartPick: async (ids, value) => {
      if (ids.length === 0) return;
      await prisma.build.updateMany({
        where: { id: { in: ids } },
        data: { isSmartPick: value },
      });
    },
  },
];

export type GovernanceSweepOptions = {
  /**
   * When true, skip all writes. Used to preview what would happen
   * in staging without touching data.
   */
  dryRun?: boolean;
  /** Override "now" for deterministic tests. */
  now?: Date;
  /** The actor recorded in the audit log. Defaults to the asset owner. */
  systemUserId?: number;
};

/**
 * Run the daily governance sweep across every asset type.
 *
 * Order of operations per type:
 *   1. Warn owners whose assets fall due within the next 7 days.
 *   2. Archive assets that are already overdue (UNVERIFIED).
 *   3. Archive assets with no usage or rating activity in 30 days (INACTIVE).
 *   4. Archive assets with ≥10 ratings and a raw average below 2 (LOW_RATING).
 *   5. Smart Picks are curated by admins only (no automatic recompute here).
 *
 * All state changes write an AssetVerification audit row.
 */
export async function runGovernanceSweep(
  options: GovernanceSweepOptions = {},
): Promise<SweepResult> {
  const now = options.now ?? new Date();
  governanceSweepClock = now;
  const dryRun = options.dryRun ?? false;
  const warnUntil = new Date(now.getTime() + WARNING_WINDOW_DAYS * DAY_MS);
  const inactivityCutoff = new Date(now.getTime() - INACTIVITY_DAYS * DAY_MS);

  const byAssetType = {} as Record<AssetType, AssetTypeSweepResult>;
  const totals: SweepCounts = {
    warningsSent: 0,
    archivedUnverified: 0,
    archivedInactive: 0,
    archivedLowRating: 0,
  };

  for (const config of assetConfigs) {
    const result: AssetTypeSweepResult = {
      assetType: config.assetType,
      warningsSent: 0,
      archivedUnverified: 0,
      archivedInactive: 0,
      archivedLowRating: 0,
    };

    const warnCandidates = await config.findPublishedWithDueWithin(warnUntil);
    for (const asset of warnCandidates) {
      if (!asset.verificationDueAt) continue;
      if (!dryRun) {
        await sendWarningEmail(
          asset,
          config.typeLabel,
          config.urlSegment,
          asset.verificationDueAt,
        );
        await config.markWarning(asset.id, now);
      }
      result.warningsSent += 1;
    }

    const overdue = await config.findOverdue(now);
    for (const asset of overdue) {
      if (!dryRun) {
        await config.archive(asset.id, ArchiveReason.UNVERIFIED, now);
        await writeAudit(
          prisma,
          config.assetType,
          asset.id,
          options.systemUserId ?? asset.owner.id,
          VerificationAction.ARCHIVED,
          ArchiveReason.UNVERIFIED,
          "Auto-archived: verification window expired.",
        );
        await sendArchivedEmail(
          asset,
          config.typeLabel,
          config.urlSegment,
          ArchiveReason.UNVERIFIED,
        );
      }
      result.archivedUnverified += 1;
    }

    const inactive = await config.findInactive(inactivityCutoff);
    for (const asset of inactive) {
      if (!dryRun) {
        await config.archive(asset.id, ArchiveReason.INACTIVE, now);
        await writeAudit(
          prisma,
          config.assetType,
          asset.id,
          options.systemUserId ?? asset.owner.id,
          VerificationAction.ARCHIVED,
          ArchiveReason.INACTIVE,
          "Auto-archived: no usage or ratings in 30 days.",
        );
        await sendArchivedEmail(
          asset,
          config.typeLabel,
          config.urlSegment,
          ArchiveReason.INACTIVE,
        );
      }
      result.archivedInactive += 1;
    }

    const lowRated = await config.findLowRated(
      LOW_RATING_MIN_COUNT,
      LOW_RATING_THRESHOLD,
    );
    for (const asset of lowRated) {
      if (!dryRun) {
        await config.archive(asset.id, ArchiveReason.LOW_RATING, now);
        await writeAudit(
          prisma,
          config.assetType,
          asset.id,
          options.systemUserId ?? asset.owner.id,
          VerificationAction.ARCHIVED,
          ArchiveReason.LOW_RATING,
          "Auto-archived: low community rating.",
        );
        await sendArchivedEmail(
          asset,
          config.typeLabel,
          config.urlSegment,
          ArchiveReason.LOW_RATING,
        );
      }
      result.archivedLowRating += 1;
    }

    byAssetType[config.assetType] = result;
    totals.warningsSent += result.warningsSent;
    totals.archivedUnverified += result.archivedUnverified;
    totals.archivedInactive += result.archivedInactive;
    totals.archivedLowRating += result.archivedLowRating;
  }

  return {
    byAssetType,
    totals,
    smartPicksRecomputed: 0,
    startedAt: now,
    finishedAt: new Date(),
    dryRun,
  };
}

/**
 * Recompute `isSmartPick` for each asset type by taking the top N items
 * (after hard-filtering archived or overdue assets) by flag-adjusted score.
 *
 * Returns the total number of assets flipped on or off.
 */
export async function recomputeSmartPicks(options: {
  dryRun?: boolean;
  now?: Date;
} = {}): Promise<number> {
  const now = options.now ?? new Date();
  governanceSweepClock = now;
  const dryRun = options.dryRun ?? false;
  let changed = 0;

  for (const config of assetConfigs) {
    const kind = config.assetType as AssetKind;
    const topIds = await computeTopScored(kind, SMART_PICK_TOP_N, now);
    const topIdSet = new Set(topIds);

    const currentSmart = await config.listCurrentSmartPicks();
    const currentSet = new Set(currentSmart);

    const toEnable = topIds.filter((id) => !currentSet.has(id));
    const toDisable = currentSmart.filter((id) => !topIdSet.has(id));

    if (!dryRun) {
      if (toEnable.length > 0) await config.setSmartPick(toEnable, true);
      if (toDisable.length > 0) await config.setSmartPick(toDisable, false);
    }
    changed += toEnable.length + toDisable.length;
  }

  return changed;
}

/**
 * Thin wrapper used by the Heroku Scheduler entrypoint and the manual
 * admin trigger. Honors the GOVERNANCE_SWEEP_ENABLED feature flag so that
 * during rollout we can dry-run safely.
 */
export async function runGovernanceSweepWithGate(
  options: GovernanceSweepOptions = {},
): Promise<SweepResult> {
  if (!env.governanceSweepEnabled && !options.dryRun) {
    console.log(
      "[governance] GOVERNANCE_SWEEP_ENABLED=false; running in dry-run mode.",
    );
    return runGovernanceSweep({ ...options, dryRun: true });
  }
  return runGovernanceSweep(options);
}
