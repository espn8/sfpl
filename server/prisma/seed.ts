import { PrismaClient } from "@prisma/client";
import {
  ensureSystemCollections,
  refreshAllToolCollections,
  refreshBestOfCollection,
} from "../src/services/systemCollections";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");
  const shouldReset =
    process.env.SEED_RESET === "true" ||
    process.env.SEED_RESET === "1" ||
    process.env.SEED_RESET === "yes";

  if (shouldReset) {
    const existingTeam = await prisma.team.findUnique({
      where: { slug: "demo-team" },
      select: { id: true, name: true },
    });

    if (existingTeam) {
      console.log(`SEED_RESET enabled. Clearing existing data for team: ${existingTeam.name}`);
      await prisma.$transaction(async (tx) => {
        const teamPrompts = await tx.prompt.findMany({
          where: { teamId: existingTeam.id },
          select: { id: true },
        });
        const promptIds = teamPrompts.map((prompt) => prompt.id);

        const teamUsers = await tx.user.findMany({
          where: { teamId: existingTeam.id },
          select: { id: true },
        });
        const userIds = teamUsers.map((user) => user.id);

        if (promptIds.length > 0) {
          await tx.usageEvent.deleteMany({ where: { promptId: { in: promptIds } } });
          await tx.favorite.deleteMany({ where: { promptId: { in: promptIds } } });
          await tx.rating.deleteMany({ where: { promptId: { in: promptIds } } });
          await tx.promptVariable.deleteMany({ where: { promptId: { in: promptIds } } });
          await tx.promptTag.deleteMany({ where: { promptId: { in: promptIds } } });
          await tx.promptVersion.deleteMany({ where: { promptId: { in: promptIds } } });
          await tx.collectionPrompt.deleteMany({ where: { promptId: { in: promptIds } } });
        }

        await tx.collectionPrompt.deleteMany({ where: { collection: { teamId: existingTeam.id } } });
        await tx.collection.deleteMany({ where: { teamId: existingTeam.id } });
        await tx.prompt.deleteMany({ where: { teamId: existingTeam.id } });
        await tx.skill.deleteMany({ where: { teamId: existingTeam.id } });
        await tx.contextDocument.deleteMany({ where: { teamId: existingTeam.id } });
        // Tags are global; junction rows are removed with assets or via cascades.
        if (userIds.length > 0) {
          await tx.usageEvent.deleteMany({ where: { userId: { in: userIds } } });
          await tx.favorite.deleteMany({ where: { userId: { in: userIds } } });
          await tx.rating.deleteMany({ where: { userId: { in: userIds } } });
          await tx.promptVersion.deleteMany({ where: { createdById: { in: userIds } } });
        }

        await tx.user.deleteMany({ where: { teamId: existingTeam.id } });
        await tx.team.delete({ where: { id: existingTeam.id } });
      });
      console.log("Reset completed for demo-team.");
    } else {
      console.log("SEED_RESET enabled, but demo-team does not exist. Nothing to clear.");
    }
  }

  const team = await prisma.team.upsert({
    where: { slug: "demo-team" },
    create: {
      name: "Demo Team",
      slug: "demo-team",
    },
    update: {},
  });
  console.log(`Team: ${team.name} (${team.slug})`);

  const demoUsers = [
    { email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com", name: "Alex Admin", role: "ADMIN" as const },
    { email: "owner@example.com", name: "Olivia Owner", role: "OWNER" as const },
    { email: "member@example.com", name: "Mina Member", role: "MEMBER" as const },
    { email: "viewer@example.com", name: "Victor Viewer", role: "VIEWER" as const },
  ];

  const usersByEmail = new Map<string, Awaited<ReturnType<typeof prisma.user.upsert>>>();
  for (const userData of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      create: {
        email: userData.email,
        name: userData.name,
        role: userData.role,
        teamId: team.id,
      },
      update: {
        name: userData.name,
        role: userData.role,
        teamId: team.id,
      },
    });
    usersByEmail.set(user.email, user);
  }

  console.log(`Upserted ${usersByEmail.size} demo users`);

  const tags = [
    "chatgpt",
    "claude",
    "gemini",
    "coding",
    "writing",
    "research",
    "support",
    "marketing",
    "sales",
    "analysis",
  ];

  const tagsByName = new Map<string, Awaited<ReturnType<typeof prisma.tag.upsert>>>();
  for (const tagName of tags) {
    const tag = await prisma.tag.upsert({
      where: { name: tagName },
      create: {
        name: tagName,
      },
      update: {},
    });
    tagsByName.set(tagName, tag);
  }
  console.log(`Upserted ${tags.length} tags`);

  const admin = usersByEmail.get(process.env.SEED_ADMIN_EMAIL ?? "admin@example.com");
  const owner = usersByEmail.get("owner@example.com");
  const member = usersByEmail.get("member@example.com");
  const viewer = usersByEmail.get("viewer@example.com");
  if (!admin || !owner || !member || !viewer) {
    throw new Error("Failed to load seeded users.");
  }

  type PromptSeed = {
    title: string;
    summary: string;
    body: string;
    ownerId: number;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    visibility: "PUBLIC" | "TEAM";
    tools: string[];
    modality: "TEXT" | "CODE" | "IMAGE" | "VIDEO" | "AUDIO" | "MULTIMODAL";
    modelHint: string;
    tags: string[];
    variables: Array<{ key: string; label: string; defaultValue: string; required: boolean }>;
  };

  const promptSeeds: PromptSeed[] = [
    {
      title: "Code Review Assistant",
      summary: "Reviews pull requests and surfaces bugs, risks, and maintainability concerns.",
      body: "You are an expert code reviewer. Analyze the diff below and return:\n1) High-risk defects\n2) Logic and edge-case gaps\n3) Performance and security concerns\n4) Suggested refactors with rationale\n\n[DIFF]",
      ownerId: admin.id,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      tools: ["cursor"],
      modality: "CODE",
      modelHint: "chatgpt",
      tags: ["chatgpt", "coding", "analysis"],
      variables: [{ key: "DIFF", label: "Git diff", defaultValue: "", required: true }],
    },
    {
      title: "Customer Email Reply",
      summary: "Drafts empathetic, concise customer support responses with clear next steps.",
      body: "Write a support response using this context:\n- Customer message: [CUSTOMER_MESSAGE]\n- Account tier: [ACCOUNT_TIER]\n- Product area: [PRODUCT_AREA]\n\nReturn a response that acknowledges the issue, explains what happened, and provides next steps.",
      ownerId: member.id,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      tools: ["claude_code"],
      modality: "TEXT",
      modelHint: "claude",
      tags: ["support", "writing"],
      variables: [
        { key: "CUSTOMER_MESSAGE", label: "Customer message", defaultValue: "", required: true },
        { key: "ACCOUNT_TIER", label: "Account tier", defaultValue: "Pro", required: false },
        { key: "PRODUCT_AREA", label: "Product area", defaultValue: "Billing", required: false },
      ],
    },
    {
      title: "Blog Post Outliner",
      summary: "Generates SEO-aware long-form content outlines from a topic and audience.",
      body: "Create a detailed blog post outline for [TOPIC] targeting [AUDIENCE]. Include a title, intro hook, 4 sections, and a CTA.",
      ownerId: member.id,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      tools: ["claude_code"],
      modality: "TEXT",
      modelHint: "claude",
      tags: ["writing", "marketing"],
      variables: [
        { key: "TOPIC", label: "Post topic", defaultValue: "", required: true },
        { key: "AUDIENCE", label: "Target audience", defaultValue: "B2B SaaS buyers", required: false },
      ],
    },
    {
      title: "Quarterly Sales Objection Handler",
      summary: "Creates rebuttals for common enterprise sales objections.",
      body: "Given objection [OBJECTION] and product capability [CAPABILITY], write a confident but honest response with proof points and a discovery question.",
      ownerId: owner.id,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      tools: ["gemini"],
      modality: "TEXT",
      modelHint: "gemini",
      tags: ["sales", "research"],
      variables: [
        { key: "OBJECTION", label: "Buyer objection", defaultValue: "", required: true },
        { key: "CAPABILITY", label: "Relevant capability", defaultValue: "", required: true },
      ],
    },
    {
      title: "Incident Postmortem Draft",
      summary: "Turns timeline notes into a structured internal postmortem.",
      body: "Using timeline [TIMELINE] and impact [IMPACT], produce a blameless postmortem with root cause, contributing factors, and action items.",
      ownerId: admin.id,
      status: "DRAFT",
      visibility: "PUBLIC",
      tools: ["cursor"],
      modality: "TEXT",
      modelHint: "chatgpt",
      tags: ["analysis", "research"],
      variables: [
        { key: "TIMELINE", label: "Incident timeline", defaultValue: "", required: true },
        { key: "IMPACT", label: "Customer impact", defaultValue: "", required: true },
      ],
    },
    {
      title: "Personal 1:1 Preparation Prompt",
      summary: "Private template for weekly manager one-on-one prep.",
      body: "Prepare 1:1 notes from:\n- Wins: [WINS]\n- Risks: [RISKS]\n- Topics to discuss: [TOPICS]\nReturn concise bullets.",
      ownerId: viewer.id,
      status: "DRAFT",
      visibility: "TEAM",
      tools: ["cursor"],
      modality: "TEXT",
      modelHint: "chatgpt",
      tags: ["writing"],
      variables: [
        { key: "WINS", label: "Wins", defaultValue: "", required: false },
        { key: "RISKS", label: "Risks", defaultValue: "", required: false },
        { key: "TOPICS", label: "Topics", defaultValue: "", required: false },
      ],
    },
    {
      title: "Legacy Campaign Rewriter",
      summary: "Archived campaign rewriting prompt kept for historical reference.",
      body: "Rewrite this legacy campaign copy [COPY] into modern product voice while preserving legal constraints [LEGAL].",
      ownerId: owner.id,
      status: "ARCHIVED",
      visibility: "PUBLIC",
      tools: ["claude_code"],
      modality: "TEXT",
      modelHint: "claude",
      tags: ["marketing", "writing"],
      variables: [
        { key: "COPY", label: "Legacy copy", defaultValue: "", required: true },
        { key: "LEGAL", label: "Legal constraints", defaultValue: "", required: false },
      ],
    },
    {
      title: "Research Interview Synthesizer",
      summary: "Converts customer interview notes into themes and recommended actions.",
      body: "Summarize interviews [NOTES] into themes, evidence quotes, and product recommendations.",
      ownerId: member.id,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      tools: ["gemini"],
      modality: "TEXT",
      modelHint: "gemini",
      tags: ["research", "analysis"],
      variables: [{ key: "NOTES", label: "Interview notes", defaultValue: "", required: true }],
    },
  ];

  const promptsByTitle = new Map<string, Awaited<ReturnType<typeof prisma.prompt.create>>>();
  for (const seed of promptSeeds) {
    const existing = await prisma.prompt.findFirst({
      where: { teamId: team.id, title: seed.title },
      include: { promptTags: true, variables: true },
    });

    const prompt =
      existing ??
      (await prisma.prompt.create({
        data: {
          teamId: team.id,
          ownerId: seed.ownerId,
          title: seed.title,
          summary: seed.summary,
          body: seed.body,
          status: seed.status,
          ...(seed.status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
          visibility: seed.visibility,
          tools: seed.tools,
          modality: seed.modality,
          modelHint: seed.modelHint,
          versions: {
            create: {
              version: 1,
              body: seed.body,
              createdById: seed.ownerId,
              changelog: "Initial version",
            },
          },
        },
      }));

    promptsByTitle.set(prompt.title, prompt);

    for (const tagName of seed.tags) {
      const tag = tagsByName.get(tagName);
      if (!tag) {
        continue;
      }
      await prisma.promptTag.upsert({
        where: {
          promptId_tagId: {
            promptId: prompt.id,
            tagId: tag.id,
          },
        },
        create: {
          promptId: prompt.id,
          tagId: tag.id,
        },
        update: {},
      });
    }

    for (const variable of seed.variables) {
      await prisma.promptVariable.upsert({
        where: {
          promptId_key: {
            promptId: prompt.id,
            key: variable.key,
          },
        },
        create: {
          promptId: prompt.id,
          key: variable.key,
          label: variable.label,
          defaultValue: variable.defaultValue,
          required: variable.required,
        },
        update: {
          label: variable.label,
          defaultValue: variable.defaultValue,
          required: variable.required,
        },
      });
    }
  }
  console.log(`Ensured ${promptsByTitle.size} prompts`);

  const collectionSeeds = [
    {
      name: "Starter Collection",
      description: "Essential prompts for getting started",
      createdById: admin.id,
      promptTitles: ["Code Review Assistant", "Customer Email Reply", "Blog Post Outliner"],
      isSystem: false,
    },
    {
      name: "Go-To-Market Toolkit",
      description: "Prompts used by sales and marketing for campaigns and objections.",
      createdById: owner.id,
      promptTitles: ["Quarterly Sales Objection Handler", "Blog Post Outliner", "Legacy Campaign Rewriter"],
      isSystem: false,
    },
    {
      name: "Ops and Reliability",
      description: "Prompts supporting incident response and postmortem practices.",
      createdById: admin.id,
      promptTitles: ["Incident Postmortem Draft", "Research Interview Synthesizer"],
      isSystem: false,
    },
  ];

  for (const seed of collectionSeeds) {
    const collection = await prisma.collection.upsert({
      where: {
        teamId_name: {
          teamId: team.id,
          name: seed.name,
        },
      },
      create: {
        teamId: team.id,
        createdById: seed.createdById,
        name: seed.name,
        description: seed.description,
        isSystem: seed.isSystem,
      },
      update: {
        description: seed.description,
        isSystem: seed.isSystem,
      },
    });

    for (let index = 0; index < seed.promptTitles.length; index += 1) {
      const promptTitle = seed.promptTitles[index];
      const prompt = promptsByTitle.get(promptTitle);
      if (!prompt) {
        continue;
      }
      await prisma.collectionPrompt.upsert({
        where: {
          collectionId_promptId: {
            collectionId: collection.id,
            promptId: prompt.id,
          },
        },
        create: {
          collectionId: collection.id,
          promptId: prompt.id,
          sortOrder: index,
          addedById: admin.id,
        },
        update: {
          sortOrder: index,
        },
      });
    }
  }
  console.log(`Ensured ${collectionSeeds.length} collections`);

  await ensureSystemCollections(team.id, admin.id);
  await refreshAllToolCollections(team.id);
  await refreshBestOfCollection(team.id);
  console.log("Ensured system tool collections and Best of AI Library");

  const sampleSkillTitle = "Sample Team Skill";
  if (!(await prisma.skill.findFirst({ where: { teamId: team.id, title: sampleSkillTitle } }))) {
    await prisma.skill.create({
      data: {
        teamId: team.id,
        ownerId: admin.id,
        title: sampleSkillTitle,
        summary: "A starter skill for local development.",
        body: "## When to use\n\nApply this skill when reviewing internal docs.\n\n## Steps\n\n1. Read the draft\n2. Note gaps\n3. Suggest edits\n",
        visibility: "PUBLIC",
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
  }

  const sampleContextTitle = "Engineering style guide";
  if (!(await prisma.contextDocument.findFirst({ where: { teamId: team.id, title: sampleContextTitle } }))) {
    await prisma.contextDocument.create({
      data: {
        teamId: team.id,
        ownerId: member.id,
        title: sampleContextTitle,
        summary: "Markdown context file for tone and formatting.",
        body: "# Voice\n\n- Clear and concise\n- Prefer active voice\n\n# Code samples\n\nUse fenced blocks with language tags.\n",
        visibility: "PUBLIC",
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
  }
  console.log("Ensured sample skill and context document (if missing)");

  const ratingsSeed = [
    { userEmail: admin.email, promptTitle: "Code Review Assistant", value: 5 },
    { userEmail: member.email, promptTitle: "Code Review Assistant", value: 4 },
    { userEmail: viewer.email, promptTitle: "Customer Email Reply", value: 5 },
    { userEmail: owner.email, promptTitle: "Quarterly Sales Objection Handler", value: 5 },
    { userEmail: member.email, promptTitle: "Research Interview Synthesizer", value: 4 },
    { userEmail: admin.email, promptTitle: "Blog Post Outliner", value: 4 },
  ];

  for (const ratingSeed of ratingsSeed) {
    const prompt = promptsByTitle.get(ratingSeed.promptTitle);
    if (!prompt) {
      continue;
    }
    await prisma.rating.upsert({
      where: {
        userId_promptId: {
          userId: usersByEmail.get(ratingSeed.userEmail)!.id,
          promptId: prompt.id,
        },
      },
      create: {
        userId: usersByEmail.get(ratingSeed.userEmail)!.id,
        promptId: prompt.id,
        value: ratingSeed.value,
      },
      update: {
        value: ratingSeed.value,
      },
    });
  }

  const favoriteSeeds = [
    { userEmail: admin.email, promptTitle: "Code Review Assistant" },
    { userEmail: member.email, promptTitle: "Customer Email Reply" },
    { userEmail: viewer.email, promptTitle: "Blog Post Outliner" },
    { userEmail: owner.email, promptTitle: "Quarterly Sales Objection Handler" },
    { userEmail: admin.email, promptTitle: "Research Interview Synthesizer" },
  ];

  for (const favoriteSeed of favoriteSeeds) {
    const prompt = promptsByTitle.get(favoriteSeed.promptTitle);
    if (!prompt) {
      continue;
    }
    await prisma.favorite.upsert({
      where: {
        userId_promptId: {
          userId: usersByEmail.get(favoriteSeed.userEmail)!.id,
          promptId: prompt.id,
        },
      },
      create: {
        userId: usersByEmail.get(favoriteSeed.userEmail)!.id,
        promptId: prompt.id,
      },
      update: {},
    });
  }
  console.log("Ensured demo favorites and ratings");

  const usageSeeds: Array<{ promptTitle: string; userEmail: string; action: "VIEW" | "COPY" | "LAUNCH"; repeat: number }> = [
    { promptTitle: "Code Review Assistant", userEmail: admin.email, action: "VIEW", repeat: 12 },
    { promptTitle: "Code Review Assistant", userEmail: member.email, action: "COPY", repeat: 6 },
    { promptTitle: "Customer Email Reply", userEmail: member.email, action: "LAUNCH", repeat: 8 },
    { promptTitle: "Customer Email Reply", userEmail: viewer.email, action: "VIEW", repeat: 10 },
    { promptTitle: "Blog Post Outliner", userEmail: admin.email, action: "VIEW", repeat: 7 },
    { promptTitle: "Quarterly Sales Objection Handler", userEmail: owner.email, action: "LAUNCH", repeat: 9 },
    { promptTitle: "Research Interview Synthesizer", userEmail: member.email, action: "VIEW", repeat: 11 },
    { promptTitle: "Incident Postmortem Draft", userEmail: admin.email, action: "COPY", repeat: 3 },
  ];

  const usageData: Array<{ promptId: number; userId: number; action: "VIEW" | "COPY" | "LAUNCH" }> = [];
  for (const usageSeed of usageSeeds) {
    const prompt = promptsByTitle.get(usageSeed.promptTitle);
    const user = usersByEmail.get(usageSeed.userEmail);
    if (!prompt || !user) {
      continue;
    }

    for (let index = 0; index < usageSeed.repeat; index += 1) {
      usageData.push({
        promptId: prompt.id,
        userId: user.id,
        action: usageSeed.action,
      });
    }
  }

  if (usageData.length > 0) {
    await prisma.usageEvent.createMany({
      data: usageData,
    });
    console.log(`Added ${usageData.length} usage events`);
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
