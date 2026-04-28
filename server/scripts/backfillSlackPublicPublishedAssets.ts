/**
 * One-off backfill: POST every PUBLIC + PUBLISHED Prompt, Skill, Context doc, and Build
 * to the Slack Workflow webhook (same payload as live creates), in stable order, with
 * a 60-second pause between each POST when sending for real.
 *
 * Required env:
 *   - DATABASE_URL
 *   - APP_BASE_URL (e.g. https://ail.mysalesforcedemo.com for correct asset links in payload)
 *
 * Required for --send only:
 *   - SLACK_NEW_PUBLIC_ASSET_WEBHOOK_URL
 *
 * Usage (from repo root):
 *   DATABASE_URL="..." APP_BASE_URL="https://ail.mysalesforcedemo.com" \
 *     SLACK_NEW_PUBLIC_ASSET_WEBHOOK_URL="..." \
 *     npx tsx server/scripts/backfillSlackPublicPublishedAssets.ts
 *
 *   # Actually POST (60s between each; estimated wall time ~(N-1) minutes):
 *   npx tsx server/scripts/backfillSlackPublicPublishedAssets.ts --send
 *
 * Heroku one-off (app name may differ):
 *   heroku run 'cd server && npx tsx scripts/backfillSlackPublicPublishedAssets.ts --send' -a aosfail
 *
 * Does not import server/src/config/env.ts — only the three vars above (plus --send).
 */
import { PrismaClient, type PromptModality } from "@prisma/client";
import {
  sendSlackPublicPublishedAsset,
  slackAssetWebPath,
  type SlackAssetKind,
} from "../src/services/slackNewPublicAssetCore";

const SEND = process.argv.includes("--send");
const SIXTY_SEC_MS = 60_000;

type QueuedAsset = {
  createdAt: Date;
  kind: SlackAssetKind;
  id: number;
  title: string;
  summary: string | null;
  ownerId: number;
  tools: string[];
  modality: PromptModality | null | undefined;
  tagNames: string[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  const webhookUrl = process.env.SLACK_NEW_PUBLIC_ASSET_WEBHOOK_URL?.trim();

  if (!databaseUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  if (!appBaseUrl) {
    console.error("APP_BASE_URL is required (e.g. https://ail.mysalesforcedemo.com).");
    process.exit(1);
  }
  if (SEND && !webhookUrl) {
    console.error("--send requires SLACK_NEW_PUBLIC_ASSET_WEBHOOK_URL.");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });

  const [prompts, skills, contextDocs, builds] = await Promise.all([
    prisma.prompt.findMany({
      where: { visibility: "PUBLIC", status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        summary: true,
        ownerId: true,
        createdAt: true,
        tools: true,
        modality: true,
        promptTags: { include: { tag: { select: { name: true } } } },
      },
    }),
    prisma.skill.findMany({
      where: { visibility: "PUBLIC", status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        summary: true,
        ownerId: true,
        createdAt: true,
        tools: true,
        skillTags: { include: { tag: { select: { name: true } } } },
      },
    }),
    prisma.contextDocument.findMany({
      where: { visibility: "PUBLIC", status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        summary: true,
        ownerId: true,
        createdAt: true,
        tools: true,
        contextTags: { include: { tag: { select: { name: true } } } },
      },
    }),
    prisma.build.findMany({
      where: { visibility: "PUBLIC", status: "PUBLISHED" },
      select: {
        id: true,
        title: true,
        summary: true,
        ownerId: true,
        createdAt: true,
        buildTags: { include: { tag: { select: { name: true } } } },
      },
    }),
  ]);

  const queue: QueuedAsset[] = [
    ...prompts.map((p) => ({
      createdAt: p.createdAt,
      kind: "prompt" as const,
      id: p.id,
      title: p.title,
      summary: p.summary,
      ownerId: p.ownerId,
      tools: p.tools,
      modality: p.modality,
      tagNames: p.promptTags.map((row) => row.tag.name),
    })),
    ...skills.map((s) => ({
      createdAt: s.createdAt,
      kind: "skill" as const,
      id: s.id,
      title: s.title,
      summary: s.summary,
      ownerId: s.ownerId,
      tools: s.tools,
      modality: undefined,
      tagNames: s.skillTags.map((row) => row.tag.name),
    })),
    ...contextDocs.map((c) => ({
      createdAt: c.createdAt,
      kind: "context" as const,
      id: c.id,
      title: c.title,
      summary: c.summary,
      ownerId: c.ownerId,
      tools: c.tools,
      modality: undefined,
      tagNames: c.contextTags.map((row) => row.tag.name),
    })),
    ...builds.map((b) => ({
      createdAt: b.createdAt,
      kind: "build" as const,
      id: b.id,
      title: b.title,
      summary: b.summary,
      ownerId: b.ownerId,
      tools: [],
      modality: undefined,
      tagNames: b.buildTags.map((row) => row.tag.name),
    })),
  ];

  queue.sort((a, b) => {
    const byTime = a.createdAt.getTime() - b.createdAt.getTime();
    if (byTime !== 0) {
      return byTime;
    }
    const byKind = a.kind.localeCompare(b.kind);
    if (byKind !== 0) {
      return byKind;
    }
    return a.id - b.id;
  });

  const mode = SEND ? "SEND" : "DRY-RUN";
  const n = queue.length;
  const estMinutes = n > 0 && SEND ? Math.max(0, n - 1) : 0;
  console.log(
    `${mode}: ${n} PUBLIC+PUBLISHED asset(s).` +
      (SEND && n > 0 ? ` Estimated wall time ~${estMinutes} min (${SIXTY_SEC_MS / 1000}s between POSTs).` : ""),
  );

  try {
    for (let i = 0; i < queue.length; i += 1) {
      const item = queue[i];
      const link = `${appBaseUrl.replace(/\/+$/, "")}/${slackAssetWebPath(item.kind, item.id)}`;

      if (!SEND) {
        console.log(
          `[dry-run] would POST ${item.kind} ${item.id} "${item.title.slice(0, 60)}${item.title.length > 60 ? "…" : ""}" ${link}`,
        );
      } else {
        console.log(`[send] POST ${item.kind} ${item.id} (${i + 1}/${n}) …`);
        try {
          await sendSlackPublicPublishedAsset(prisma, {
            webhookUrl: webhookUrl!,
            appBaseUrl,
            assetKind: item.kind,
            id: item.id,
            title: item.title,
            summary: item.summary,
            tools: item.tools,
            modality: item.modality,
            tagNames: item.tagNames,
            ownerId: item.ownerId,
          });
        } catch (err) {
          console.error(`[send] error for ${item.kind} ${item.id}:`, err);
        }
        if (i < queue.length - 1) {
          console.log(`[send] waiting ${SIXTY_SEC_MS / 1000}s before next POST…`);
          await sleep(SIXTY_SEC_MS);
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log("Done.");
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
