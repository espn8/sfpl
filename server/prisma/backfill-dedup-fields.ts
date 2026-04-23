import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

const BATCH_SIZE = 100;

function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, " ");
}

function normalizeBody(body: string): string {
  return body.toLowerCase().trim().replace(/\s+/g, " ");
}

function computeBodyHash(body: string): string {
  const normalized = normalizeBody(body);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

async function backfillPrompts() {
  console.log("Backfilling Prompts...");
  let processed = 0;
  let cursor: number | undefined;

  const seenHashes = new Set<string>();

  while (true) {
    const prompts = await prisma.prompt.findMany({
      where: {
        OR: [{ titleNormalized: null }, { bodyHash: null }],
      },
      select: { id: true, title: true, body: true },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
    });

    if (prompts.length === 0) break;

    for (const prompt of prompts) {
      const titleNormalized = normalizeTitle(prompt.title);
      const bodyHash = computeBodyHash(prompt.body);

      if (seenHashes.has(bodyHash)) {
        console.warn(`  Skipping Prompt ${prompt.id} - duplicate bodyHash detected (will need manual review)`);
        continue;
      }
      seenHashes.add(bodyHash);

      try {
        await prisma.prompt.update({
          where: { id: prompt.id },
          data: { titleNormalized, bodyHash },
        });
        processed++;
      } catch (error) {
        console.error(`  Error updating Prompt ${prompt.id}:`, error);
      }
    }

    cursor = prompts[prompts.length - 1].id;
    console.log(`  Processed ${processed} prompts...`);
  }

  console.log(`Completed backfilling ${processed} Prompts.`);
}

async function backfillSkills() {
  console.log("Backfilling Skills...");
  let processed = 0;
  let cursor: number | undefined;

  const seenUrls = new Set<string>();

  while (true) {
    const skills = await prisma.skill.findMany({
      where: { skillUrlNormalized: null },
      select: { id: true, skillUrl: true },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
    });

    if (skills.length === 0) break;

    for (const skill of skills) {
      const skillUrlNormalized = normalizeUrl(skill.skillUrl);

      if (seenUrls.has(skillUrlNormalized)) {
        console.warn(`  Skipping Skill ${skill.id} - duplicate URL detected (will need manual review)`);
        continue;
      }
      seenUrls.add(skillUrlNormalized);

      try {
        await prisma.skill.update({
          where: { id: skill.id },
          data: { skillUrlNormalized },
        });
        processed++;
      } catch (error) {
        console.error(`  Error updating Skill ${skill.id}:`, error);
      }
    }

    cursor = skills[skills.length - 1].id;
    console.log(`  Processed ${processed} skills...`);
  }

  console.log(`Completed backfilling ${processed} Skills.`);
}

async function backfillContextDocuments() {
  console.log("Backfilling ContextDocuments...");
  let processed = 0;
  let cursor: number | undefined;

  const seenHashes = new Set<string>();

  while (true) {
    const contexts = await prisma.contextDocument.findMany({
      where: {
        OR: [{ titleNormalized: null }, { bodyHash: null }],
      },
      select: { id: true, title: true, body: true },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
    });

    if (contexts.length === 0) break;

    for (const context of contexts) {
      const titleNormalized = normalizeTitle(context.title);
      const bodyHash = computeBodyHash(context.body);

      if (seenHashes.has(bodyHash)) {
        console.warn(`  Skipping ContextDocument ${context.id} - duplicate bodyHash detected (will need manual review)`);
        continue;
      }
      seenHashes.add(bodyHash);

      try {
        await prisma.contextDocument.update({
          where: { id: context.id },
          data: { titleNormalized, bodyHash },
        });
        processed++;
      } catch (error) {
        console.error(`  Error updating ContextDocument ${context.id}:`, error);
      }
    }

    cursor = contexts[contexts.length - 1].id;
    console.log(`  Processed ${processed} context documents...`);
  }

  console.log(`Completed backfilling ${processed} ContextDocuments.`);
}

async function backfillBuilds() {
  console.log("Backfilling Builds...");
  let processed = 0;
  let cursor: number | undefined;

  const seenUrls = new Set<string>();

  while (true) {
    const builds = await prisma.build.findMany({
      where: { buildUrlNormalized: null },
      select: { id: true, buildUrl: true },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
    });

    if (builds.length === 0) break;

    for (const build of builds) {
      const buildUrlNormalized = normalizeUrl(build.buildUrl);

      if (seenUrls.has(buildUrlNormalized)) {
        console.warn(`  Skipping Build ${build.id} - duplicate URL detected (will need manual review)`);
        continue;
      }
      seenUrls.add(buildUrlNormalized);

      try {
        await prisma.build.update({
          where: { id: build.id },
          data: { buildUrlNormalized },
        });
        processed++;
      } catch (error) {
        console.error(`  Error updating Build ${build.id}:`, error);
      }
    }

    cursor = builds[builds.length - 1].id;
    console.log(`  Processed ${processed} builds...`);
  }

  console.log(`Completed backfilling ${processed} Builds.`);
}

async function main() {
  console.log("Starting deduplication fields backfill...\n");

  await backfillPrompts();
  console.log("");

  await backfillSkills();
  console.log("");

  await backfillContextDocuments();
  console.log("");

  await backfillBuilds();
  console.log("");

  console.log("Backfill complete!");
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
