import { Prisma, UsageAction } from "@prisma/client";
import type { AuthContext } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { buildVisibilityWhereFragment } from "../lib/visibility";
import { getGlobalWeekViewUseScores } from "./weekViewUseScores";
import { getWeekTopAssetKeySet, weekTopAssetKey } from "./weekTopAssets";
import { thumbnailRefFor } from "../routes/thumbnails";
import { mapDbModalityToApi } from "../lib/modality";

function mapLegacyModelHintToTools(modelHint?: string | null): string[] {
  const value = modelHint?.trim().toLowerCase();
  if (!value) return [];
  if (value === "chatgpt" || value === "chat gpt" || value === "gpt" || value === "openai") return ["chatgpt"];
  if (value === "cursor") return ["cursor"];
  if (value === "claude code" || value === "claude_code" || value === "claudecode" || value === "claude") return ["claude_code"];
  if (value === "claude cowork" || value === "claude_cowork" || value === "claudecowork" || value === "cowork") return ["claude_cowork"];
  if (value === "meshmesh") return ["meshmesh"];
  if (value === "slackbot" || value === "slack bot") return ["slackbot"];
  if (value === "gemini") return ["gemini"];
  if (value === "notebooklm" || value === "notebook lm") return ["notebooklm"];
  return [];
}

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  facets: { assetType: { prompt: number; skill: number; context: number; build: number }; tool: Record<string, number> };
  snapshot?: Record<string, unknown>;
};

/**
 * Homepage “Top Assets This Week”: global PUBLIC 7-day view+use ranking, hydrated for the viewer’s visibility rules.
 */
export async function buildMostUsedThisWeekListResponse(
  auth: AuthContext,
  page: number,
  pageSize: number,
  includeSnapshot: boolean,
): Promise<{ data: unknown[]; meta: ListMeta }> {
  const ranked = await getGlobalWeekViewUseScores(Math.min(400, page * pageSize + pageSize * 3));
  const promptIds = ranked.filter((r) => r.assetType === "prompt").map((r) => r.id);
  const skillIds = ranked.filter((r) => r.assetType === "skill").map((r) => r.id);
  const contextIds = ranked.filter((r) => r.assetType === "context").map((r) => r.id);
  const buildIds = ranked.filter((r) => r.assetType === "build").map((r) => r.id);

  const promptVis = buildVisibilityWhereFragment(auth);
  const skillVis = buildVisibilityWhereFragment(auth);
  const contextVis = buildVisibilityWhereFragment(auth);
  const buildVis = buildVisibilityWhereFragment(auth);

  const promptWhere: Prisma.PromptWhereInput = {
    ...(promptIds.length ? { id: { in: promptIds } } : {}),
    status: "PUBLISHED",
    ...(promptVis.OR ? { AND: [promptVis] } : {}),
  };
  const skillWhere: Prisma.SkillWhereInput = {
    ...(skillIds.length ? { id: { in: skillIds } } : {}),
    status: "PUBLISHED",
    ...(skillVis.OR ? { AND: [skillVis] } : {}),
  };
  const contextWhere: Prisma.ContextDocumentWhereInput = {
    ...(contextIds.length ? { id: { in: contextIds } } : {}),
    status: "PUBLISHED",
    ...(contextVis.OR ? { AND: [contextVis] } : {}),
  };
  const buildWhere: Prisma.BuildWhereInput = {
    ...(buildIds.length ? { id: { in: buildIds } } : {}),
    status: "PUBLISHED",
    ...(buildVis.OR ? { AND: [buildVis] } : {}),
  };

  const [prompts, skills, contextDocs, builds, weekTopKeys] = await Promise.all([
    promptIds.length
      ? prisma.prompt.findMany({
          where: promptWhere,
          select: {
            id: true,
            title: true,
            summary: true,
            status: true,
            visibility: true,
            modelHint: true,
            tools: true,
            modality: true,
            thumbnailStatus: true,
            isSmartPick: true,
            usageCount: true,
            createdAt: true,
            updatedAt: true,
            owner: { select: { id: true, name: true, avatarUrl: true } },
            variables: { select: { key: true, label: true, defaultValue: true, required: true } },
            ratings: { select: { value: true } },
            promptTags: { select: { tag: { select: { name: true } } } },
          },
        })
      : [],
    skillIds.length
      ? prisma.skill.findMany({
          where: skillWhere,
          select: {
            id: true,
            title: true,
            summary: true,
            skillUrl: true,
            supportUrl: true,
            status: true,
            visibility: true,
            tools: true,
            modality: true,
            thumbnailStatus: true,
            isSmartPick: true,
            usageCount: true,
            createdAt: true,
            updatedAt: true,
            owner: { select: { id: true, name: true, avatarUrl: true } },
            skillTags: { select: { tag: { select: { name: true } } } },
          },
        })
      : [],
    contextIds.length
      ? prisma.contextDocument.findMany({
          where: contextWhere,
          select: {
            id: true,
            title: true,
            summary: true,
            status: true,
            visibility: true,
            tools: true,
            modality: true,
            thumbnailStatus: true,
            isSmartPick: true,
            usageCount: true,
            createdAt: true,
            updatedAt: true,
            owner: { select: { id: true, name: true, avatarUrl: true } },
            variables: { select: { key: true, label: true, defaultValue: true, required: true } },
            contextTags: { select: { tag: { select: { name: true } } } },
          },
        })
      : [],
    buildIds.length
      ? prisma.build.findMany({
          where: buildWhere,
          select: {
            id: true,
            title: true,
            summary: true,
            buildUrl: true,
            supportUrl: true,
            status: true,
            visibility: true,
            modality: true,
            thumbnailStatus: true,
            isSmartPick: true,
            usageCount: true,
            createdAt: true,
            updatedAt: true,
            owner: { select: { id: true, name: true, avatarUrl: true } },
            buildTags: { select: { tag: { select: { name: true } } } },
          },
        })
      : [],
    getWeekTopAssetKeySet(auth.teamId),
  ]);

  const promptMap = new Map(prompts.map((p) => [p.id, p]));
  const skillMap = new Map(skills.map((s) => [s.id, s]));
  const contextMap = new Map(contextDocs.map((c) => [c.id, c]));
  const buildMap = new Map(builds.map((b) => [b.id, b]));

  type Row = {
    assetType: "prompt" | "skill" | "context" | "build";
    id: number;
    weekScore: number;
    payload: unknown;
  };
  const hydrated: Row[] = [];

  for (const r of ranked) {
    if (r.assetType === "prompt") {
      const prompt = promptMap.get(r.id);
      if (!prompt) continue;
      hydrated.push({ assetType: "prompt", id: r.id, weekScore: r.weekScore, payload: prompt });
    } else if (r.assetType === "skill") {
      const skill = skillMap.get(r.id);
      if (!skill) continue;
      hydrated.push({ assetType: "skill", id: r.id, weekScore: r.weekScore, payload: skill });
    } else if (r.assetType === "context") {
      const doc = contextMap.get(r.id);
      if (!doc) continue;
      hydrated.push({ assetType: "context", id: r.id, weekScore: r.weekScore, payload: doc });
    } else {
      const build = buildMap.get(r.id);
      if (!build) continue;
      hydrated.push({ assetType: "build", id: r.id, weekScore: r.weekScore, payload: build });
    }
  }

  const total = hydrated.length;
  const skip = (page - 1) * pageSize;
  const pageRows = hydrated.slice(skip, skip + pageSize);
  const pagePromptIds = pageRows.filter((x) => x.assetType === "prompt").map((x) => x.id);
  const pageSkillIds = pageRows.filter((x) => x.assetType === "skill").map((x) => x.id);
  const pageContextIds = pageRows.filter((x) => x.assetType === "context").map((x) => x.id);
  const pageBuildIds = pageRows.filter((x) => x.assetType === "build").map((x) => x.id);

  const [
    promptAggs,
    skillAggs,
    contextAggs,
    buildAggs,
  ] = await Promise.all([
    pagePromptIds.length
      ? Promise.all([
          prisma.usageEvent.groupBy({
            by: ["promptId"],
            where: { promptId: { in: pagePromptIds }, action: UsageAction.VIEW },
            _count: { _all: true },
          }),
          prisma.favorite.findMany({
            where: { userId: auth.userId, promptId: { in: pagePromptIds } },
            select: { promptId: true },
          }),
          prisma.favorite.groupBy({
            by: ["promptId"],
            where: { promptId: { in: pagePromptIds } },
            _count: { _all: true },
          }),
          prisma.rating.findMany({
            where: { userId: auth.userId, promptId: { in: pagePromptIds } },
            select: { promptId: true, value: true },
          }),
        ])
      : Promise.resolve([[], [], [], []] as const),
    pageSkillIds.length
      ? Promise.all([
          prisma.skillUsageEvent.groupBy({
            by: ["skillId"],
            where: { skillId: { in: pageSkillIds }, eventType: "VIEW" },
            _count: { skillId: true },
          }),
          prisma.skillFavorite.findMany({
            where: { userId: auth.userId, skillId: { in: pageSkillIds } },
            select: { skillId: true },
          }),
          prisma.skillFavorite.groupBy({
            by: ["skillId"],
            where: { skillId: { in: pageSkillIds } },
            _count: { _all: true },
          }),
          prisma.skillRating.findMany({
            where: { userId: auth.userId, skillId: { in: pageSkillIds } },
            select: { skillId: true, value: true },
          }),
          prisma.skillRating.groupBy({
            by: ["skillId"],
            where: { skillId: { in: pageSkillIds } },
            _count: { skillId: true },
            _avg: { value: true },
          }),
        ])
      : Promise.resolve([[], [], [], [], []] as const),
    pageContextIds.length
      ? Promise.all([
          prisma.contextUsageEvent.groupBy({
            by: ["contextId"],
            where: { contextId: { in: pageContextIds }, eventType: "VIEW" },
            _count: { contextId: true },
          }),
          prisma.contextFavorite.findMany({
            where: { userId: auth.userId, contextId: { in: pageContextIds } },
            select: { contextId: true },
          }),
          prisma.contextFavorite.groupBy({
            by: ["contextId"],
            where: { contextId: { in: pageContextIds } },
            _count: { _all: true },
          }),
          prisma.contextRating.findMany({
            where: { userId: auth.userId, contextId: { in: pageContextIds } },
            select: { contextId: true, value: true },
          }),
          prisma.contextRating.groupBy({
            by: ["contextId"],
            where: { contextId: { in: pageContextIds } },
            _count: { contextId: true },
            _avg: { value: true },
          }),
        ])
      : Promise.resolve([[], [], [], [], []] as const),
    pageBuildIds.length
      ? Promise.all([
          prisma.buildUsageEvent.groupBy({
            by: ["buildId"],
            where: { buildId: { in: pageBuildIds }, eventType: "VIEW" },
            _count: { buildId: true },
          }),
          prisma.buildFavorite.findMany({
            where: { userId: auth.userId, buildId: { in: pageBuildIds } },
            select: { buildId: true },
          }),
          prisma.buildFavorite.groupBy({
            by: ["buildId"],
            where: { buildId: { in: pageBuildIds } },
            _count: { _all: true },
          }),
          prisma.buildRating.findMany({
            where: { userId: auth.userId, buildId: { in: pageBuildIds } },
            select: { buildId: true, value: true },
          }),
          prisma.buildRating.groupBy({
            by: ["buildId"],
            where: { buildId: { in: pageBuildIds } },
            _count: { buildId: true },
            _avg: { value: true },
          }),
        ])
      : Promise.resolve([[], [], [], [], []] as const),
  ]);

  const [pView, pFavRows, pFavCount, pRateRows] = promptAggs as [
    { promptId: number; _count: { _all: number } }[],
    { promptId: number }[],
    { promptId: number; _count: { _all: number } }[],
    { promptId: number; value: number }[],
  ];
  const viewCountByPrompt = new Map(pView.map((g) => [g.promptId, g._count._all]));
  const favoritedPromptIds = new Set(pFavRows.map((r) => r.promptId));
  const favoriteCountByPrompt = new Map(pFavCount.map((g) => [g.promptId, g._count._all]));
  const myRatingByPrompt = new Map(pRateRows.map((r) => [r.promptId, r.value]));

  const [sView, sFavRows, sFavCount, sRateRows, sRateGroups] = skillAggs as [
    { skillId: number; _count: { skillId: number } }[],
    { skillId: number }[],
    { skillId: number; _count: { _all: number } }[],
    { skillId: number; value: number }[],
    { skillId: number; _count: { skillId: number }; _avg: { value: number | null } }[],
  ];
  const viewCountBySkill = new Map(sView.map((g) => [g.skillId, g._count.skillId]));
  const favoritedSkillIds = new Set(sFavRows.map((r) => r.skillId));
  const favoriteCountBySkill = new Map(sFavCount.map((g) => [g.skillId, g._count._all]));
  const myRatingBySkill = new Map(sRateRows.map((r) => [r.skillId, r.value]));
  const ratingDataBySkill = new Map(sRateGroups.map((g) => [g.skillId, { count: g._count.skillId, avg: g._avg.value }]));

  const [cView, cFavRows, cFavCount, cRateRows, cRateGroups] = contextAggs as [
    { contextId: number; _count: { contextId: number } }[],
    { contextId: number }[],
    { contextId: number; _count: { _all: number } }[],
    { contextId: number; value: number }[],
    { contextId: number; _count: { contextId: number }; _avg: { value: number | null } }[],
  ];
  const viewCountByContext = new Map(cView.map((g) => [g.contextId, g._count.contextId]));
  const favoritedContextIds = new Set(cFavRows.map((r) => r.contextId));
  const favoriteCountByContext = new Map(cFavCount.map((g) => [g.contextId, g._count._all]));
  const myRatingByContext = new Map(cRateRows.map((r) => [r.contextId, r.value]));
  const ratingDataByContext = new Map(cRateGroups.map((g) => [g.contextId, { count: g._count.contextId, avg: g._avg.value }]));

  const [bView, bFavRows, bFavCount, bRateRows, bRateGroups] = buildAggs as [
    { buildId: number; _count: { buildId: number } }[],
    { buildId: number }[],
    { buildId: number; _count: { _all: number } }[],
    { buildId: number; value: number }[],
    { buildId: number; _count: { buildId: number }; _avg: { value: number | null } }[],
  ];
  const viewCountByBuild = new Map(bView.map((g) => [g.buildId, g._count.buildId]));
  const favoritedBuildIds = new Set(bFavRows.map((r) => r.buildId));
  const favoriteCountByBuild = new Map(bFavCount.map((g) => [g.buildId, g._count._all]));
  const myRatingByBuild = new Map(bRateRows.map((r) => [r.buildId, r.value]));
  const ratingDataByBuild = new Map(bRateGroups.map((g) => [g.buildId, { count: g._count.buildId, avg: g._avg.value }]));

  const data = pageRows.map((row) => {
    if (row.assetType === "prompt") {
      const prompt = row.payload as (typeof prompts)[0];
      const tools = prompt.tools.length > 0 ? prompt.tools : mapLegacyModelHintToTools(prompt.modelHint);
      return {
        id: prompt.id,
        assetType: "prompt" as const,
        title: prompt.title,
        summary: prompt.summary,
        status: prompt.status,
        visibility: prompt.visibility,
        tools,
        createdAt: prompt.createdAt,
        updatedAt: prompt.updatedAt,
        owner: prompt.owner,
        viewCount: viewCountByPrompt.get(prompt.id) ?? 0,
        usageCount: row.weekScore,
        favorited: favoritedPromptIds.has(prompt.id),
        favoriteCount: favoriteCountByPrompt.get(prompt.id) ?? 0,
        ratingCount: prompt.ratings.length,
        modality: mapDbModalityToApi(prompt.modality),
        modelHint: prompt.modelHint,
        thumbnailUrl: thumbnailRefFor("prompt", prompt.id, prompt.thumbnailStatus, prompt.updatedAt),
        thumbnailStatus: prompt.thumbnailStatus,
        averageRating:
          prompt.ratings.length === 0 ? null : prompt.ratings.reduce((sum, r) => sum + r.value, 0) / prompt.ratings.length,
        myRating: myRatingByPrompt.get(prompt.id) ?? null,
        variables: prompt.variables,
        isSmartPick: prompt.isSmartPick,
        tags: (prompt.promptTags ?? []).map((pt) => pt.tag.name),
        isTopAssetThisWeek: weekTopKeys.has(weekTopAssetKey("prompt", prompt.id)),
      };
    }
    if (row.assetType === "skill") {
      const skill = row.payload as (typeof skills)[0];
      const ratingInfo = ratingDataBySkill.get(skill.id);
      return {
        id: skill.id,
        assetType: "skill" as const,
        title: skill.title,
        summary: skill.summary,
        skillUrl: skill.skillUrl,
        supportUrl: skill.supportUrl,
        status: skill.status,
        visibility: skill.visibility,
        tools: skill.tools,
        thumbnailUrl: thumbnailRefFor("skill", skill.id, skill.thumbnailStatus, skill.updatedAt),
        thumbnailStatus: skill.thumbnailStatus,
        createdAt: skill.createdAt,
        updatedAt: skill.updatedAt,
        owner: skill.owner,
        viewCount: viewCountBySkill.get(skill.id) ?? 0,
        usageCount: row.weekScore,
        favorited: favoritedSkillIds.has(skill.id),
        favoriteCount: favoriteCountBySkill.get(skill.id) ?? 0,
        ratingCount: ratingInfo?.count ?? 0,
        modality: mapDbModalityToApi(skill.modality),
        averageRating: ratingInfo?.avg ?? null,
        myRating: myRatingBySkill.get(skill.id) ?? null,
        isSmartPick: skill.isSmartPick,
        tags: (skill.skillTags ?? []).map((st) => st.tag.name),
        isTopAssetThisWeek: weekTopKeys.has(weekTopAssetKey("skill", skill.id)),
      };
    }
    if (row.assetType === "context") {
      const doc = row.payload as (typeof contextDocs)[0];
      const ratingInfo = ratingDataByContext.get(doc.id);
      return {
        id: doc.id,
        assetType: "context" as const,
        title: doc.title,
        summary: doc.summary,
        status: doc.status,
        visibility: doc.visibility,
        tools: doc.tools,
        thumbnailUrl: thumbnailRefFor("context", doc.id, doc.thumbnailStatus, doc.updatedAt),
        thumbnailStatus: doc.thumbnailStatus,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        owner: doc.owner,
        viewCount: viewCountByContext.get(doc.id) ?? 0,
        usageCount: row.weekScore,
        favorited: favoritedContextIds.has(doc.id),
        favoriteCount: favoriteCountByContext.get(doc.id) ?? 0,
        ratingCount: ratingInfo?.count ?? 0,
        modality: mapDbModalityToApi(doc.modality),
        averageRating: ratingInfo?.avg ?? null,
        myRating: myRatingByContext.get(doc.id) ?? null,
        variables: doc.variables,
        isSmartPick: doc.isSmartPick,
        tags: (doc.contextTags ?? []).map((ct) => ct.tag.name),
        isTopAssetThisWeek: weekTopKeys.has(weekTopAssetKey("context", doc.id)),
      };
    }
    const build = row.payload as (typeof builds)[0];
    const ratingInfo = ratingDataByBuild.get(build.id);
    return {
      id: build.id,
      assetType: "build" as const,
      title: build.title,
      summary: build.summary,
      body: build.buildUrl,
      skillUrl: build.buildUrl,
      supportUrl: build.supportUrl,
      status: build.status,
      visibility: build.visibility,
      tools: [] as string[],
      modality: mapDbModalityToApi(build.modality),
      thumbnailUrl: thumbnailRefFor("build", build.id, build.thumbnailStatus, build.updatedAt),
      thumbnailStatus: build.thumbnailStatus,
      createdAt: build.createdAt,
      updatedAt: build.updatedAt,
      owner: build.owner,
      viewCount: viewCountByBuild.get(build.id) ?? 0,
      usageCount: row.weekScore,
      favorited: favoritedBuildIds.has(build.id),
      favoriteCount: favoriteCountByBuild.get(build.id) ?? 0,
      ratingCount: ratingInfo?.count ?? 0,
      averageRating: ratingInfo?.avg ?? null,
      myRating: myRatingByBuild.get(build.id) ?? null,
      isSmartPick: build.isSmartPick,
      tags: (build.buildTags ?? []).map((bt) => bt.tag.name),
      isTopAssetThisWeek: weekTopKeys.has(weekTopAssetKey("build", build.id)),
    };
  });

  const facets = {
    assetType: { prompt: 0, skill: 0, context: 0, build: 0 },
    tool: {} as Record<string, number>,
  };
  for (const item of data as { assetType: string; tools?: string[] }[]) {
    facets.assetType[item.assetType as keyof typeof facets.assetType] += 1;
    for (const t of item.tools ?? []) {
      facets.tool[t] = (facets.tool[t] ?? 0) + 1;
    }
  }

  let snapshot: Record<string, unknown> | undefined;
  if (includeSnapshot) {
    const visibilityFragment = buildVisibilityWhereFragment(auth);
    const [
      promptsPublished,
      skillsPublished,
      contextPublished,
      buildsPublished,
      activeUsers,
      promptUsageCount,
      skillUsageCount,
      contextUsageCount,
      buildUsageCount,
    ] = await Promise.all([
      prisma.prompt.count({
        where: { status: "PUBLISHED", AND: [visibilityFragment as Prisma.PromptWhereInput] },
      }),
      prisma.skill.count({
        where: { status: "PUBLISHED", AND: [visibilityFragment as Prisma.SkillWhereInput] },
      }),
      prisma.contextDocument.count({
        where: { status: "PUBLISHED", AND: [visibilityFragment as Prisma.ContextDocumentWhereInput] },
      }),
      prisma.build.count({
        where: { status: "PUBLISHED", AND: [visibilityFragment as Prisma.BuildWhereInput] },
      }),
      prisma.user.count({ where: { teamId: auth.teamId } }),
      prisma.usageEvent.count({
        where: { prompt: { AND: [visibilityFragment as Prisma.PromptWhereInput] } },
      }),
      prisma.skillUsageEvent.count({
        where: { skill: { AND: [visibilityFragment as Prisma.SkillWhereInput] } },
      }),
      prisma.contextUsageEvent.count({
        where: { context: { AND: [visibilityFragment as Prisma.ContextDocumentWhereInput] } },
      }),
      prisma.buildUsageEvent.count({
        where: { build: { AND: [visibilityFragment as Prisma.BuildWhereInput] } },
      }),
    ]);
    snapshot = {
      assetsPublished: promptsPublished + skillsPublished + contextPublished + buildsPublished,
      promptsPublished,
      skillsPublished,
      contextPublished,
      buildsPublished,
      activeUsers,
      promptsUsed: promptUsageCount + skillUsageCount + contextUsageCount + buildUsageCount,
    };
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const meta: ListMeta = {
    page,
    pageSize,
    total,
    totalPages,
    facets,
    ...(snapshot ? { snapshot } : {}),
  };

  return { data, meta };
}
