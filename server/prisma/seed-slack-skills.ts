import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Skills Seed File
 * 
 * NOTE: Skills now use a URL-based format instead of body content.
 * Each skill requires:
 * - skillUrl: A URL to a compressed file (.zip, .tar, .tar.gz, .tgz, .tar.bz2, .7z, .rar)
 * - supportUrl: (optional) A URL to documentation
 * 
 * The previous body-based skills have been archived to:
 * - skills-backup-2026-04-23.csv (metadata)
 * - skills-backup-2026-04-23-full.json (full details with body references)
 * 
 * To add new skills, update the skillSeeds array below with proper URLs.
 */

async function main() {
  console.log("Starting Skills seed...");

  const team = await prisma.team.upsert({
    where: { slug: "demo-team" },
    create: {
      name: "Demo Team",
      slug: "demo-team",
    },
    update: {},
  });
  console.log(`Using team: ${team.name} (${team.slug})`);

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    create: {
      email: "demo@example.com",
      name: "Demo User",
      role: "MEMBER",
      teamId: team.id,
    },
    update: {
      teamId: team.id,
    },
  });
  console.log(`Using demo user: ${demoUser.name}`);

  type SkillSeed = {
    title: string;
    summary: string;
    skillUrl: string;
    supportUrl?: string;
    ownerId: number;
    tools?: string[];
  };

  // Example skills - replace with actual skill package URLs
  const skillSeeds: SkillSeed[] = [
    // Add your skills here with proper URLs to compressed files
    // Example:
    // {
    //   title: "My Skill",
    //   summary: "Description of what this skill does",
    //   skillUrl: "https://github.com/user/repo/releases/download/v1.0/skill.zip",
    //   supportUrl: "https://github.com/user/repo#readme",
    //   ownerId: demoUser.id,
    //   tools: ["claude_code"],
    // },
  ];

  let created = 0;
  let skipped = 0;

  for (const seed of skillSeeds) {
    const existing = await prisma.skill.findFirst({
      where: { teamId: team.id, title: seed.title },
    });

    if (existing) {
      console.log(`Skill already exists: ${seed.title} (skipping)`);
      skipped++;
      continue;
    }

    await prisma.skill.create({
      data: {
        teamId: team.id,
        ownerId: seed.ownerId,
        title: seed.title,
        summary: seed.summary,
        skillUrl: seed.skillUrl,
        supportUrl: seed.supportUrl ?? null,
        visibility: "PUBLIC",
        status: "PUBLISHED",
        tools: seed.tools ?? ["slackbot"],
      },
    });
    console.log(`Created skill: ${seed.title}`);
    created++;
  }

  console.log(`\nSkills seed completed!`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped (already exists): ${skipped}`);
  console.log(`  Total skills in seed: ${skillSeeds.length}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
