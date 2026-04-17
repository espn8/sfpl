import { prisma } from "../lib/prisma";

const TOOL_COLLECTION_MAP: Record<string, { name: string; description: string }> = {
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

export async function ensureSystemCollections(teamId: number, adminUserId: number): Promise<void> {
  // Ensure tool-based collections exist
  for (const [toolKey, collectionInfo] of Object.entries(TOOL_COLLECTION_MAP)) {
    await prisma.collection.upsert({
      where: {
        teamId_name: {
          teamId,
          name: collectionInfo.name,
        },
      },
      create: {
        teamId,
        createdById: adminUserId,
        name: collectionInfo.name,
        description: collectionInfo.description,
        isSystem: true,
      },
      update: {
        isSystem: true,
      },
    });
  }

  // Ensure Best of AI Library exists
  await prisma.collection.upsert({
    where: {
      teamId_name: {
        teamId,
        name: BEST_OF_COLLECTION_NAME,
      },
    },
    create: {
      teamId,
      createdById: adminUserId,
      name: BEST_OF_COLLECTION_NAME,
      description: BEST_OF_COLLECTION_DESCRIPTION,
      isSystem: true,
    },
    update: {
      isSystem: true,
    },
  });
}

export async function refreshToolCollection(teamId: number, toolKey: string): Promise<void> {
  const collectionInfo = TOOL_COLLECTION_MAP[toolKey];
  if (!collectionInfo) {
    return;
  }

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

  const matchingPrompts = await prisma.prompt.findMany({
    where: {
      teamId,
      tools: { has: toolKey },
      status: "PUBLISHED",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.collectionPrompt.deleteMany({
      where: { collectionId: collection.id },
    });

    if (matchingPrompts.length > 0) {
      await tx.collectionPrompt.createMany({
        data: matchingPrompts.map((prompt, index) => ({
          collectionId: collection.id,
          promptId: prompt.id,
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
