import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  const team = await prisma.team.upsert({
    where: { slug: "demo-team" },
    create: {
      name: "Demo Team",
      slug: "demo-team",
    },
    update: {},
  });
  console.log(`Team: ${team.name} (${team.slug})`);

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: "Admin User",
      role: "ADMIN",
      teamId: team.id,
    },
    update: {},
  });
  console.log(`Admin user: ${admin.email}`);

  const memberEmail = "member@example.com";
  const member = await prisma.user.upsert({
    where: { email: memberEmail },
    create: {
      email: memberEmail,
      name: "Team Member",
      role: "MEMBER",
      teamId: team.id,
    },
    update: {},
  });
  console.log(`Member user: ${member.email}`);

  const tags = ["chatgpt", "claude", "coding", "writing", "research"];
  for (const tagName of tags) {
    await prisma.tag.upsert({
      where: {
        teamId_name: {
          teamId: team.id,
          name: tagName,
        },
      },
      create: {
        teamId: team.id,
        name: tagName,
      },
      update: {},
    });
  }
  console.log(`Created ${tags.length} tags`);

  const existingPrompts = await prisma.prompt.findMany({
    where: { teamId: team.id },
  });

  if (existingPrompts.length === 0) {
    const chatgptTag = await prisma.tag.findFirst({
      where: { teamId: team.id, name: "chatgpt" },
    });
    const codingTag = await prisma.tag.findFirst({
      where: { teamId: team.id, name: "coding" },
    });

    const prompt1 = await prisma.prompt.create({
      data: {
        teamId: team.id,
        ownerId: admin.id,
        title: "Code Review Assistant",
        summary: "Reviews code and provides actionable feedback",
        body: "You are an expert code reviewer. Review the following code and provide constructive feedback on:\n\n1. Code quality and readability\n2. Potential bugs or edge cases\n3. Performance considerations\n4. Best practices\n\n[CODE]\n",
        status: "PUBLISHED",
        visibility: "TEAM",
        modelHint: "chatgpt",
        modality: "code",
        versions: {
          create: {
            version: 1,
            body: "You are an expert code reviewer. Review the following code and provide constructive feedback on:\n\n1. Code quality and readability\n2. Potential bugs or edge cases\n3. Performance considerations\n4. Best practices\n\n[CODE]\n",
            createdById: admin.id,
            changelog: "Initial version",
          },
        },
        promptTags: chatgptTag && codingTag
          ? {
              create: [
                { tagId: chatgptTag.id },
                { tagId: codingTag.id },
              ],
            }
          : undefined,
      },
    });

    const writingTag = await prisma.tag.findFirst({
      where: { teamId: team.id, name: "writing" },
    });

    const prompt2 = await prisma.prompt.create({
      data: {
        teamId: team.id,
        ownerId: member.id,
        title: "Blog Post Outliner",
        summary: "Creates structured outlines for blog posts",
        body: "Create a detailed outline for a blog post about [TOPIC]. Include:\n\n- Compelling title\n- Introduction hook\n- 3-5 main sections with subpoints\n- Conclusion with call-to-action\n- SEO keywords\n",
        status: "PUBLISHED",
        visibility: "TEAM",
        modelHint: "claude",
        modality: "text",
        versions: {
          create: {
            version: 1,
            body: "Create a detailed outline for a blog post about [TOPIC]. Include:\n\n- Compelling title\n- Introduction hook\n- 3-5 main sections with subpoints\n- Conclusion with call-to-action\n- SEO keywords\n",
            createdById: member.id,
            changelog: "Initial version",
          },
        },
        promptTags: writingTag
          ? {
              create: [{ tagId: writingTag.id }],
            }
          : undefined,
      },
    });

    console.log(`Created prompts: "${prompt1.title}" and "${prompt2.title}"`);

    const collection = await prisma.collection.create({
      data: {
        teamId: team.id,
        createdById: admin.id,
        name: "Starter Collection",
        description: "Essential prompts for getting started",
        prompts: {
          create: [
            { promptId: prompt1.id, sortOrder: 0 },
            { promptId: prompt2.id, sortOrder: 1 },
          ],
        },
      },
    });

    console.log(`Created collection: "${collection.name}"`);

    await prisma.favorite.create({
      data: {
        userId: admin.id,
        promptId: prompt1.id,
      },
    });

    await prisma.rating.create({
      data: {
        userId: admin.id,
        promptId: prompt1.id,
        value: 5,
      },
    });

    await prisma.rating.create({
      data: {
        userId: member.id,
        promptId: prompt2.id,
        value: 4,
      },
    });

    console.log("Created sample favorites and ratings");

    await prisma.usageEvent.createMany({
      data: [
        { promptId: prompt1.id, userId: admin.id, action: "VIEW" },
        { promptId: prompt1.id, userId: admin.id, action: "COPY" },
        { promptId: prompt1.id, userId: member.id, action: "VIEW" },
        { promptId: prompt2.id, userId: member.id, action: "VIEW" },
        { promptId: prompt2.id, userId: member.id, action: "LAUNCH" },
      ],
    });

    console.log("Created sample usage events");
  } else {
    console.log(`Skipping prompts creation - ${existingPrompts.length} prompts already exist`);
  }

  console.log("Seed completed successfully!");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
