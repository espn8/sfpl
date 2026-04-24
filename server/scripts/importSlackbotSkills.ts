/**
 * Import slackbot skills from CSV and remove legacy slackbot-tagged Prompts.
 *
 * CSV columns (header row required):
 *   Skill Name, Description, Skill Link, Creator Email
 *
 * Usage:
 *   # Dry run (default): reports what WOULD happen, no writes.
 *   CSV_PATH=slackbot-skills-2026-04-24.csv tsx server/scripts/importSlackbotSkills.ts
 *
 *   # Apply for real:
 *   CSV_PATH=slackbot-skills-2026-04-24.csv tsx server/scripts/importSlackbotSkills.ts --apply
 *
 *   # Against Heroku prod DB:
 *   DATABASE_URL="$(heroku config:get DATABASE_URL -a aosfail)" \
 *     CSV_PATH=slackbot-skills-2026-04-24.csv \
 *     tsx server/scripts/importSlackbotSkills.ts --apply
 *
 * Behavior (in --apply mode):
 *   1. Deletes every Prompt whose `tools` array contains "slackbot" (cascades to
 *      PromptVersion, Favorite, Rating, UsageEvent, PromptTag, CollectionPrompt,
 *      PromptVariable via schema onDelete: Cascade).
 *   2. Upserts each CSV row as a Skill keyed on `skillUrlNormalized`.
 *      - Owner resolved by email; falls back to demo@example.com.
 *      - Creates SkillVersion v1 on first insert.
 *      - On update: refreshes title/summary/supportUrl/tools; does NOT bump version.
 *
 * All existing Skills (slackbot or otherwise) NOT referenced by the CSV are
 * left untouched.
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { normalizeUrl } from "../src/services/dedup";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const APPLY = process.argv.includes("--apply");
const CSV_PATH = process.env.CSV_PATH ?? "slackbot-skills-2026-04-24.csv";
const FALLBACK_EMAIL = "demo@example.com";
const TEAM_SLUG = "demo-team";

type Row = {
  title: string;
  summary: string;
  skillUrl: string;
  ownerEmail: string;
};

// Minimal RFC-4180-ish CSV parser (handles quoted fields w/ commas and escaped quotes).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim().length > 0));
}

function loadRows(csvPath: string): Row[] {
  const abs = path.isAbsolute(csvPath)
    ? csvPath
    : path.resolve(process.cwd(), csvPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`CSV not found: ${abs}`);
  }

  const text = fs.readFileSync(abs, "utf-8");
  const parsed = parseCsv(text);
  if (parsed.length < 2) {
    throw new Error(`CSV appears empty: ${abs}`);
  }

  const header = parsed[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => {
    const idx = header.indexOf(name.toLowerCase());
    if (idx === -1) throw new Error(`Missing CSV column: ${name}`);
    return idx;
  };

  const titleIdx = col("Skill Name");
  const descIdx = col("Description");
  const linkIdx = col("Skill Link");
  const emailIdx = col("Creator Email");

  const rows: Row[] = [];
  for (let i = 1; i < parsed.length; i++) {
    const r = parsed[i];
    const title = (r[titleIdx] ?? "").trim();
    const summary = (r[descIdx] ?? "").trim();
    const skillUrl = (r[linkIdx] ?? "").trim();
    const ownerEmail = (r[emailIdx] ?? "").trim().toLowerCase();
    if (!title || !skillUrl) continue;
    rows.push({ title, summary, skillUrl, ownerEmail });
  }
  return rows;
}

async function main() {
  console.log(`${APPLY ? "APPLY" : "DRY-RUN"} mode — CSV: ${CSV_PATH}`);
  console.log(
    `DATABASE_URL: ${process.env.DATABASE_URL ? "<set>" : "<missing!>"}`
  );

  const rows = loadRows(CSV_PATH);
  console.log(`Parsed ${rows.length} rows from CSV.`);

  // Detect duplicate URLs within the CSV before we hit the unique constraint.
  const urlCounts = new Map<string, number>();
  for (const r of rows) {
    const n = normalizeUrl(r.skillUrl);
    urlCounts.set(n, (urlCounts.get(n) ?? 0) + 1);
  }
  const csvDupes = [...urlCounts.entries()].filter(([, n]) => n > 1);
  if (csvDupes.length > 0) {
    console.warn(`\nWARN: ${csvDupes.length} duplicate normalized URL(s) within CSV:`);
    for (const [u, n] of csvDupes) console.warn(`  ${n}x  ${u}`);
    console.warn("Later rows will overwrite earlier ones in upserts.\n");
  }

  const team = await prisma.team.findUnique({ where: { slug: TEAM_SLUG } });
  if (!team) {
    throw new Error(`Team not found by slug "${TEAM_SLUG}".`);
  }

  const fallbackUser = await prisma.user.findUnique({
    where: { email: FALLBACK_EMAIL },
  });
  if (!fallbackUser) {
    throw new Error(
      `Fallback user not found by email "${FALLBACK_EMAIL}". Run the standard seed first.`
    );
  }
  console.log(
    `Team: ${team.name} (id ${team.id}) — fallback owner: ${fallbackUser.email} (id ${fallbackUser.id})`
  );

  // Resolve existing users for every unique email in one query.
  const uniqueEmails = [
    ...new Set(rows.map((r) => r.ownerEmail).filter(Boolean)),
  ];
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: uniqueEmails } },
    select: { id: true, email: true },
  });
  const userByEmail = new Map(existingUsers.map((u) => [u.email, u.id]));

  const missingEmails = uniqueEmails.filter((e) => !userByEmail.has(e));
  console.log(
    `\nOwner resolution: ${userByEmail.size}/${uniqueEmails.length} matched a User.`
  );
  if (missingEmails.length > 0) {
    console.log(
      `  ${missingEmails.length} emails will fall back to ${FALLBACK_EMAIL}:`
    );
    for (const e of missingEmails) console.log(`    ${e}`);
  }

  // Count prompts that will be deleted.
  const promptsToDelete = await prisma.prompt.count({
    where: { tools: { has: "slackbot" } },
  });
  console.log(
    `\nLegacy Prompts with tools=[slackbot]: ${promptsToDelete} — will be DELETED.`
  );

  // Count existing matching skills.
  const normalizedUrls = rows.map((r) => normalizeUrl(r.skillUrl));
  const existingSkills = await prisma.skill.findMany({
    where: { skillUrlNormalized: { in: normalizedUrls } },
    select: { id: true, skillUrlNormalized: true, title: true },
  });
  const existingByUrl = new Map(
    existingSkills.map((s) => [s.skillUrlNormalized!, s])
  );

  let wouldCreate = 0;
  let wouldUpdate = 0;
  for (const n of normalizedUrls) {
    if (existingByUrl.has(n)) wouldUpdate++;
    else wouldCreate++;
  }
  console.log(
    `\nSkill upserts planned: create ${wouldCreate}, update ${wouldUpdate}, total ${rows.length}.`
  );

  if (!APPLY) {
    console.log("\nDry run — no writes performed. Re-run with --apply to execute.");
    return;
  }

  console.log("\n--- APPLYING CHANGES ---\n");

  // 1) Delete legacy slackbot prompts.
  const deleted = await prisma.prompt.deleteMany({
    where: { tools: { has: "slackbot" } },
  });
  console.log(`Deleted ${deleted.count} legacy slackbot Prompt(s).`);

  // 2) Upsert skills one at a time so SkillVersion v1 can be created cleanly.
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    const ownerId = userByEmail.get(row.ownerEmail) ?? fallbackUser.id;
    const skillUrlNormalized = normalizeUrl(row.skillUrl);
    const title = row.title;
    const summary = row.summary || null;

    const existing = existingByUrl.get(skillUrlNormalized);
    try {
      if (existing) {
        await prisma.skill.update({
          where: { id: existing.id },
          data: {
            title,
            summary,
            skillUrl: row.skillUrl,
            supportUrl: null,
            tools: ["slackbot"],
            status: "PUBLISHED",
            visibility: "PUBLIC",
            teamId: team.id,
            ownerId,
          },
        });
        updated++;
      } else {
        await prisma.skill.create({
          data: {
            teamId: team.id,
            ownerId,
            title,
            summary,
            skillUrl: row.skillUrl,
            skillUrlNormalized,
            supportUrl: null,
            visibility: "PUBLIC",
            status: "PUBLISHED",
            tools: ["slackbot"],
            thumbnailStatus: "PENDING",
            versions: {
              create: {
                version: 1,
                title,
                summary,
                skillUrl: row.skillUrl,
                supportUrl: null,
                createdById: ownerId,
                changelog: "Imported from slackbot-skills CSV",
              },
            },
          },
        });
        created++;
      }
    } catch (err) {
      errors++;
      console.error(`  ERROR on "${title}" (${row.skillUrl}):`, (err as Error).message);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`  Deleted legacy slackbot Prompts: ${deleted.count}`);
  console.log(`  Created Skills: ${created}`);
  console.log(`  Updated Skills: ${updated}`);
  console.log(`  Errors: ${errors}`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
