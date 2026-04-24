import { prisma } from "../lib/prisma";

export const TOOL_COLLECTION_MAP: Record<string, { name: string; description: string }> = {
  agentforce_vibes: {
    name: "Agentforce Vibes Collection",
    description: "AI assets optimized for Agentforce Vibes",
  },
  chatgpt: { name: "ChatGPT Collection", description: "AI assets optimized for ChatGPT" },
  claude_code: { name: "Claude Code Collection", description: "AI assets optimized for Claude Code" },
  claude_cowork: { name: "Claude Cowork Collection", description: "AI assets optimized for Claude Cowork" },
  cursor: { name: "Cursor Collection", description: "AI assets optimized for Cursor" },
  gemini: { name: "Gemini Collection", description: "AI assets optimized for Gemini" },
  meshmesh: { name: "MeshMesh Collection", description: "AI assets optimized for MeshMesh" },
  notebooklm: { name: "NotebookLM Collection", description: "AI assets optimized for NotebookLM" },
  saleo: { name: "Saleo Collection", description: "AI assets optimized for Saleo" },
  slackbot: { name: "Slackbot Collection", description: "AI assets optimized for Slackbot" },
};

const BEST_OF_COLLECTION_NAME = "Best of AI Library";
const BEST_OF_COLLECTION_DESCRIPTION = "The top 20 highest-rated and most-used AI assets in the library";

async function resolveCollectionCreator(teamId: number, preferredUserId?: number): Promise<number | null> {
  if (preferredUserId) {
    const existing = await prisma.user.findFirst({
      where: { id: preferredUserId, teamId },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }
  }
  const ownerOrAdmin = await prisma.user.findFirst({
    where: { teamId, role: { in: ["OWNER", "ADMIN"] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (ownerOrAdmin) {
    return ownerOrAdmin.id;
  }
  const anyUser = await prisma.user.findFirst({
    where: { teamId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return anyUser?.id ?? null;
}

export async function ensureSystemCollections(teamId: number, adminUserId?: number): Promise<void> {
  const createdById = await resolveCollectionCreator(teamId, adminUserId);
  if (!createdById) {
    return;
  }

  for (const [, collectionInfo] of Object.entries(TOOL_COLLECTION_MAP)) {
    await prisma.collection.upsert({
      where: {
        teamId_name: {
          teamId,
          name: collectionInfo.name,
        },
      },
      create: {
        teamId,
        createdById,
        name: collectionInfo.name,
        description: collectionInfo.description,
        isSystem: true,
      },
      update: {
        description: collectionInfo.description,
        isSystem: true,
      },
    });
  }

  await prisma.collection.upsert({
    where: {
      teamId_name: {
        teamId,
        name: BEST_OF_COLLECTION_NAME,
      },
    },
    create: {
      teamId,
      createdById,
      name: BEST_OF_COLLECTION_NAME,
      description: BEST_OF_COLLECTION_DESCRIPTION,
      isSystem: true,
    },
    update: {
      description: BEST_OF_COLLECTION_DESCRIPTION,
      isSystem: true,
    },
  });
}

export async function ensureSystemCollectionsForAllTeams(): Promise<void> {
  const teams = await prisma.team.findMany({ select: { id: true } });
  for (const team of teams) {
    try {
      await ensureSystemCollections(team.id);
    } catch (error) {
      console.error(`[systemCollections] Failed to ensure system collections for team ${team.id}:`, error);
    }
  }
}

export async function refreshToolCollection(teamId: number, toolKey: string): Promise<void> {
  const collectionInfo = TOOL_COLLECTION_MAP[toolKey];
  if (!collectionInfo) {
    return;
  }

  await ensureSystemCollections(teamId);

  const collection = await prisma.collection.findUnique({
    where: {
      teamId_name: {
        teamId,
        name: collectionInfo.name,
      },
    },
  });

  if (!collection || !collection.isSystem) {
    return;
  }

  const [matchingPrompts, matchingSkills, matchingContexts] = await Promise.all([
    prisma.prompt.findMany({
      where: {
        teamId,
        tools: { has: toolKey },
        status: "PUBLISHED",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    prisma.skill.findMany({
      where: {
        teamId,
        tools: { has: toolKey },
        status: "PUBLISHED",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    prisma.contextDocument.findMany({
      where: {
        teamId,
        tools: { has: toolKey },
        status: "PUBLISHED",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);

  await prisma.$transaction(async (tx) => {
    await tx.collectionPrompt.deleteMany({ where: { collectionId: collection.id } });
    await tx.collectionSkill.deleteMany({ where: { collectionId: collection.id } });
    await tx.collectionContext.deleteMany({ where: { collectionId: collection.id } });

    if (matchingPrompts.length > 0) {
      await tx.collectionPrompt.createMany({
        data: matchingPrompts.map((prompt, index) => ({
          collectionId: collection.id,
          promptId: prompt.id,
          sortOrder: index,
        })),
      });
    }

    if (matchingSkills.length > 0) {
      await tx.collectionSkill.createMany({
        data: matchingSkills.map((skill, index) => ({
          collectionId: collection.id,
          skillId: skill.id,
          sortOrder: index,
        })),
      });
    }

    if (matchingContexts.length > 0) {
      await tx.collectionContext.createMany({
        data: matchingContexts.map((context, index) => ({
          collectionId: collection.id,
          contextId: context.id,
          sortOrder: index,
        })),
      });
    }
  });
}

export async function refreshAllToolCollections(teamId: number): Promise<void> {
  for (const toolKey of Object.keys(TOOL_COLLECTION_MAP)) {
    await refreshToolCollection(teamId, toolKey);
  }
}

export async function refreshBestOfCollection(teamId: number): Promise<void> {
  await ensureSystemCollections(teamId);

  const collection = await prisma.collection.findUnique({
    where: {
      teamId_name: {
        teamId,
        name: BEST_OF_COLLECTION_NAME,
      },
    },
  });

  if (!collection || !collection.isSystem) {
    return;
  }

  const topPrompts = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT 
      p.id
    FROM "Prompt" p
    LEFT JOIN "Rating" r ON r."promptId" = p.id
    LEFT JOIN "UsageEvent" u ON u."promptId" = p.id
    WHERE p."teamId" = ${teamId}
      AND p.status = 'PUBLISHED'
    GROUP BY p.id
    ORDER BY (COALESCE(AVG(r.value), 0) * 2 + COALESCE(COUNT(DISTINCT u.id), 0) * 0.1) DESC
    LIMIT 20
  `;

  await prisma.$transaction(async (tx) => {
    await tx.collectionPrompt.deleteMany({
      where: { collectionId: collection.id },
    });

    if (topPrompts.length > 0) {
      await tx.collectionPrompt.createMany({
        data: topPrompts.map((prompt, index) => ({
          collectionId: collection.id,
          promptId: prompt.id,
          sortOrder: index,
        })),
      });
    }
  });
}

export function getToolCollectionNames(): string[] {
  return Object.values(TOOL_COLLECTION_MAP).map((info) => info.name);
}

export function getBestOfCollectionName(): string {
  return BEST_OF_COLLECTION_NAME;
}

export function isSystemCollectionName(name: string): boolean {
  return name === BEST_OF_COLLECTION_NAME || getToolCollectionNames().includes(name);
}
