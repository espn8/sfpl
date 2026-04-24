/**
 * Import slackbot skills from CSV, remove legacy slackbot-tagged Prompts, and
 * email each creator a digest of their newly imported contributions.
 *
 * CSV columns (header row required):
 *   Skill Name, Description, Skill Link, Creator Email
 *
 * Usage:
 *   # Dry run (default): reports what WOULD happen. No DB writes. No emails.
 *   CSV_PATH=slackbot-skills-2026-04-24.csv \
 *     tsx server/scripts/importSlackbotSkills.ts
 *
 *   # Apply for real (writes DB + sends emails):
 *   DATABASE_URL="$(heroku config:get DATABASE_URL -a aosfail)" \
 *     CSV_PATH=slackbot-skills-2026-04-24.csv \
 *     tsx server/scripts/importSlackbotSkills.ts --apply
 *
 *   # Apply writes but skip emails (for testing or re-runs):
 *   ... --apply --no-email
 *
 * Behavior in --apply mode:
 *   1. Deletes every Prompt whose `tools` array contains "slackbot" (cascades).
 *   2. For each unique Creator Email, upserts a User (MEMBER, demo-team). Users
 *      created with googleSub=null — they become the rightful owners when they
 *      later log in via Google OAuth (existing callback links by email).
 *   3. Upserts each CSV row as a Skill keyed on skillUrlNormalized.
 *      - Title cleanup: `\bskill\b` stripped (case-insensitive), unless the
 *        title appears in TITLE_WHITELIST (kept verbatim).
 *      - Dedup merge: rows sharing a normalized URL collapse into ONE skill
 *        whose title/summary are the source rows joined by " / ".
 *      - SkillVersion v1 created on first insert; updates don't bump version.
 *   4. Emails each creator a digest of the Skills they contributed (one email
 *      per creator, listing all skills with links). First-time users
 *      (googleSub=null) get an extra welcome paragraph about the AI Library.
 *      Only Skills created (not updated) in this run trigger emails, so re-runs
 *      don't re-notify.
 */
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { normalizeUrl } from "../src/services/dedup";
import { isEmailConfigured } from "../src/lib/email";
import { BatchMailer } from "../src/lib/batchMailer";
import {
  buildDigest,
  nameFromEmail,
  type CreatedSkillForEmail,
} from "./_slackbotDigest";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const APPLY = process.argv.includes("--apply");
const NO_EMAIL = process.argv.includes("--no-email");
const CSV_PATH = process.env.CSV_PATH ?? "slackbot-skills-2026-04-24.csv";
const TEAM_SLUG = "demo-team";

// Titles that should bypass the `\bskill\b` strip and be kept verbatim.
const TITLE_WHITELIST: ReadonlySet<string> = new Set([
  "Find Me a Skill",
  "New Skill Template (SlackAThon)",
]);

type Row = {
  title: string;
  summary: string;
  skillUrl: string;
  ownerEmail: string;
};

// ---- CSV parsing ----

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

function cleanTitle(raw: string): string {
  const trimmed = raw.trim();
  if (TITLE_WHITELIST.has(trimmed)) return trimmed;
  return trimmed.replace(/\bskill\b/gi, "").replace(/\s+/g, " ").trim();
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
    const title = cleanTitle(r[titleIdx] ?? "");
    const summary = (r[descIdx] ?? "").trim();
    const skillUrl = (r[linkIdx] ?? "").trim();
    const ownerEmail = (r[emailIdx] ?? "").trim().toLowerCase();
    if (!title || !skillUrl || !ownerEmail) continue;
    rows.push({ title, summary, skillUrl, ownerEmail });
  }
  return rows;
}

function mergeDuplicateUrls(rawRows: Row[]): { rows: Row[]; mergedGroups: number } {
  const groups = new Map<string, Row[]>();
  for (const r of rawRows) {
    const key = normalizeUrl(r.skillUrl);
    const group = groups.get(key);
    if (group) group.push(r);
    else groups.set(key, [r]);
  }

  const rows: Row[] = [];
  let mergedGroups = 0;
  for (const group of groups.values()) {
    if (group.length === 1) {
      rows.push(group[0]);
      continue;
    }

    mergedGroups++;
    const merged: Row = {
      title: group.map((g) => g.title).join(" / "),
      summary: group
        .map((g) => g.summary)
        .filter((s) => s.length > 0)
        .join(" / "),
      skillUrl: group[0].skillUrl,
      ownerEmail: group[0].ownerEmail,
    };
    rows.push(merged);

    console.log(
      `\nMerged ${group.length} rows sharing URL ${normalizeUrl(group[0].skillUrl)}:`
    );
    for (const g of group) console.log(`  - "${g.title}" (${g.ownerEmail})`);
    console.log(`  => "${merged.title}" (owner: ${merged.ownerEmail})`);
  }
  return { rows, mergedGroups };
}

// ---- Main ----

async function main() {
  const mode = APPLY ? (NO_EMAIL ? "APPLY (no-email)" : "APPLY") : "DRY-RUN";
  console.log(`${mode} mode — CSV: ${CSV_PATH}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? "<set>" : "<missing!>"}`);
  console.log(`SMTP configured: ${isEmailConfigured() ? "yes" : "NO"}`);

  const rawRows = loadRows(CSV_PATH);
  console.log(`\nParsed ${rawRows.length} rows from CSV.`);

  const { rows, mergedGroups } = mergeDuplicateUrls(rawRows);
  if (mergedGroups > 0) {
    console.log(`\nMerged ${mergedGroups} duplicate-URL group(s); final row count: ${rows.length}.`);
  }

  const team = await prisma.team.findUnique({ where: { slug: TEAM_SLUG } });
  if (!team) throw new Error(`Team not found by slug "${TEAM_SLUG}".`);
  console.log(`\nTeam: ${team.name} (id ${team.id})`);

  const uniqueEmails = [...new Set(rows.map((r) => r.ownerEmail))];
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: uniqueEmails } },
    select: { id: true, email: true, name: true, googleSub: true },
  });
  const existingByEmail = new Map(existingUsers.map((u) => [u.email, u]));
  const missingEmails = uniqueEmails.filter((e) => !existingByEmail.has(e));

  console.log(
    `\nCreators: ${uniqueEmails.length} unique | existing Users: ${existingByEmail.size} | to create: ${missingEmails.length}`
  );
  if (missingEmails.length > 0) {
    console.log(
      `  First-timers (googleSub=null — will receive welcome copy): ${missingEmails.length}`
    );
  }

  const promptsToDelete = await prisma.prompt.count({
    where: { tools: { has: "slackbot" } },
  });
  console.log(`\nLegacy Prompts with tools=[slackbot] to DELETE: ${promptsToDelete}`);

  const normalizedUrls = rows.map((r) => normalizeUrl(r.skillUrl));
  const existingSkills = await prisma.skill.findMany({
    where: { skillUrlNormalized: { in: normalizedUrls } },
    select: { id: true, skillUrlNormalized: true },
  });
  const existingSkillByUrl = new Map(
    existingSkills.map((s) => [s.skillUrlNormalized!, s])
  );
  const toCreate = rows.filter(
    (r) => !existingSkillByUrl.has(normalizeUrl(r.skillUrl))
  );
  const toUpdate = rows.length - toCreate.length;

  console.log(
    `\nSkill upserts planned: create ${toCreate.length}, update ${toUpdate}, total ${rows.length}.`
  );
  console.log(
    `Emails planned (one per unique owner of CREATED skills): ${
      new Set(toCreate.map((r) => r.ownerEmail)).size
    }`
  );

  if (!APPLY) {
    console.log("\nDry run — no writes or emails performed. Re-run with --apply.");
    return;
  }

  console.log("\n--- APPLYING CHANGES ---\n");

  // 1) Delete legacy slackbot prompts.
  const deleted = await prisma.prompt.deleteMany({
    where: { tools: { has: "slackbot" } },
  });
  console.log(`Deleted ${deleted.count} legacy slackbot Prompt(s).`);

  // 2) Upsert Users by email (create missing with googleSub=null).
  const usersByEmail = new Map<string, { id: number; name: string | null; isFirstTimer: boolean }>();
  for (const email of uniqueEmails) {
    const existing = existingByEmail.get(email);
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: nameFromEmail(email),
        role: "MEMBER",
        teamId: team.id,
      },
      update: {},
      select: { id: true, name: true, googleSub: true },
    });
    usersByEmail.set(email, {
      id: user.id,
      name: user.name,
      isFirstTimer: !user.googleSub,
    });
    if (!existing) console.log(`  + Created User: ${email} (id ${user.id})`);
  }

  // 3) Upsert Skills; track which were newly created for email purposes.
  const createdSkillsByEmail = new Map<string, CreatedSkillForEmail[]>();
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    const owner = usersByEmail.get(row.ownerEmail);
    if (!owner) {
      console.error(`  ERROR: no User resolved for ${row.ownerEmail}; skipping "${row.title}"`);
      errors++;
      continue;
    }
    const skillUrlNormalized = normalizeUrl(row.skillUrl);
    const title = row.title;
    const summary = row.summary || null;
    const existing = existingSkillByUrl.get(skillUrlNormalized);

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
            ownerId: owner.id,
          },
        });
        updated++;
      } else {
        const skill = await prisma.skill.create({
          data: {
            teamId: team.id,
            ownerId: owner.id,
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
                createdById: owner.id,
                changelog: "Imported from slackbot-skills CSV",
              },
            },
          },
          select: { id: true, title: true, summary: true, skillUrl: true },
        });
        created++;
        const list = createdSkillsByEmail.get(row.ownerEmail) ?? [];
        list.push({
          id: skill.id,
          title: skill.title,
          summary: skill.summary ?? "",
          skillUrl: skill.skillUrl,
        });
        createdSkillsByEmail.set(row.ownerEmail, list);
      }
    } catch (err) {
      errors++;
      console.error(`  ERROR on "${title}" (${row.skillUrl}):`, (err as Error).message);
    }
  }

  console.log(`\nCreated Skills: ${created}`);
  console.log(`Updated Skills: ${updated}`);
  console.log(`Errors: ${errors}`);

  // 4) Send per-user digest emails for newly created Skills.
  if (NO_EMAIL) {
    console.log("\n--no-email set; skipping email digests.");
  } else if (!isEmailConfigured()) {
    console.warn("\nSMTP not configured; skipping email digests.");
  } else {
    const entries = [...createdSkillsByEmail.entries()].filter(
      ([, skills]) => skills.length > 0
    );
    console.log(`\n--- Sending ${entries.length} digest email(s) ---`);

    const mailer = new BatchMailer({
      total: entries.length,
      onSend: ({ index, total, label, result, sentInWindow }) => {
        const prefix = `  [${index}${total ? `/${total}` : ""}]`;
        if (result.success) {
          console.log(`${prefix} OK   ${label} — ${sentInWindow}/hour window`);
        } else {
          console.error(`${prefix} FAIL ${label}: ${result.error}`);
        }
      },
    });
    mailer.logPlan(entries.length, "digest email(s)");

    for (const [email, skills] of entries) {
      const userCtx = usersByEmail.get(email);
      if (!userCtx) continue;

      const digest = buildDigest(
        { email, name: userCtx.name, isFirstTimer: userCtx.isFirstTimer },
        skills
      );

      await mailer.send(
        {
          to: email,
          subject: digest.subject,
          preheader: digest.preheader,
          html: digest.html,
          text: digest.text,
        },
        email
      );
    }

    const { sent, failed } = mailer.summary();
    console.log(`\nEmails sent: ${sent}, failed: ${failed}.`);
  }

  console.log("\n--- Done ---");
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
