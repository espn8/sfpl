import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface SkillBackup {
  title: string;
  summary: string;
  owner: string;
  ownerEmail: string;
  tools: string[];
  body: string;
}

interface BackupFile {
  exportDate: string;
  exportReason: string;
  totalSkills: number;
  skills: SkillBackup[];
  note: string;
}

function removeSkillReferences(text: string): string {
  if (!text) return text;
  
  return text
    .replace(/\bThis skill\b/gi, "This")
    .replace(/\bthis skill\b/gi, "this")
    .replace(/\bTell this skill\b/gi, "Tell me")
    .replace(/\btell this skill\b/gi, "tell me")
    .replace(/\bthe skill\b/gi, "this")
    .replace(/\bThe skill\b/gi, "This")
    .replace(/\ba skill\b/gi, "a prompt")
    .replace(/\bA skill\b/gi, "A prompt");
}

async function main() {
  console.log("Starting import of skills as prompts...\n");

  const backupPath = path.resolve(__dirname, "../../skills-backup-2026-04-23-full.json");
  
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  const backupData: BackupFile = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
  console.log(`Loaded ${backupData.totalSkills} skills from backup\n`);

  const team = await prisma.team.upsert({
    where: { slug: "demo-team" },
    create: {
      name: "Demo Team",
      slug: "demo-team",
    },
    update: {},
  });
  console.log(`Using team: ${team.name} (id: ${team.id})\n`);

  const uniqueEmails = [...new Set(backupData.skills.map((s) => s.ownerEmail))];
  console.log(`Found ${uniqueEmails.length} unique owners:\n`);

  const usersByEmail = new Map<string, { id: number; name: string | null }>();

  for (const email of uniqueEmails) {
    const skill = backupData.skills.find((s) => s.ownerEmail === email);
    const ownerName = skill?.owner ?? email.split("@")[0];

    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: ownerName,
        role: "MEMBER",
        teamId: team.id,
      },
      update: {
        teamId: team.id,
      },
    });

    usersByEmail.set(email, { id: user.id, name: user.name });
    console.log(`  - ${email} -> User ID ${user.id} (${user.name})`);
  }

  console.log("\n--- Importing prompts ---\n");

  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const skill of backupData.skills) {
    const owner = usersByEmail.get(skill.ownerEmail);
    if (!owner) {
      console.log(`WARNING: No user found for ${skill.ownerEmail}, skipping "${skill.title}"`);
      skipped++;
      continue;
    }

    const title = skill.title;
    const summary = removeSkillReferences(skill.summary);
    
    let body = skill.body;
    if (body.startsWith("See full body in seed-slack-skills.ts")) {
      body = `## What It Does\n\n${skill.summary}\n\n## How to Use\n\nProvide relevant context and ask your question.`;
    } else {
      body = removeSkillReferences(body);
    }

    const existing = await prisma.prompt.findFirst({
      where: { teamId: team.id, title },
    });

    if (existing) {
      console.log(`  [SKIP] "${title}" already exists (id: ${existing.id})`);
      skipped++;
      continue;
    }

    const prompt = await prisma.prompt.create({
      data: {
        teamId: team.id,
        ownerId: owner.id,
        title,
        summary,
        body,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        tools: skill.tools,
        modality: "TEXT",
        thumbnailStatus: "PENDING",
      },
    });

    await prisma.promptVersion.create({
      data: {
        promptId: prompt.id,
        version: 1,
        body,
        createdById: owner.id,
        changelog: "Imported from skills backup",
      },
    });

    console.log(`  [CREATE] "${title}" (id: ${prompt.id}, owner: ${owner.name})`);
    created++;
  }

  console.log("\n--- Import Summary ---\n");
  console.log(`  Created: ${created}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Total processed: ${backupData.skills.length}`);
  console.log("\nImport completed successfully!");
}

main()
  .catch((error) => {
    console.error("Import failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
