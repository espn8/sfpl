import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { getAuthContext, requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { parseSearchQuery } from "../services/searchParser";
import { buildVisibilityWhereFragment } from "../lib/visibility";

const searchRouter = Router();

const ASSET_TOOLS = [
  "agentforce_vibes",
  "chatgpt",
  "claude_code",
  "claude_cowork",
  "cursor",
  "gemini",
  "meshmesh",
  "notebooklm",
  "other",
  "saleo",
  "slackbot",
] as const;

const TOOL_LABELS: Record<string, string> = {
  agentforce_vibes: "Agentforce Vibes",
  chatgpt: "ChatGPT",
  claude_code: "Claude Code",
  claude_cowork: "Claude Cowork",
  cursor: "Cursor",
  gemini: "Gemini",
  meshmesh: "MeshMesh",
  notebooklm: "NotebookLM",
  other: "Other",
  saleo: "Saleo",
  slackbot: "Slackbot",
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  prompt: "Prompts",
  skill: "Skills",
  context: "Context",
};

const suggestionsQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  limit: z.coerce.number().int().positive().max(20).optional().default(8),
});

type AssetSuggestion = {
  type: "asset";
  id: number;
  assetType: "prompt" | "skill" | "context";
  title: string;
  tool: string | null;
  label: string;
};

type FilterSuggestion = {
  type: "filter";
  filterKey: "tool" | "assetType";
  filterValue: string;
  label: string;
};

type SuggestionsResponse = {
  assets: AssetSuggestion[];
  filters: FilterSuggestion[];
};

searchRouter.use(requireAuth);

searchRouter.get("/suggestions", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsed = suggestionsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid request.",
        details: parsed.error.issues,
      },
    });
  }

  const { q, limit } = parsed.data;
  const queryLower = q.toLowerCase();

  const matchingFilters: FilterSuggestion[] = [];

  for (const tool of ASSET_TOOLS) {
    const label = TOOL_LABELS[tool] ?? tool;
    if (label.toLowerCase().includes(queryLower) || tool.toLowerCase().includes(queryLower)) {
      matchingFilters.push({
        type: "filter",
        filterKey: "tool",
        filterValue: tool,
        label: `Tool: ${label}`,
      });
    }
  }

  for (const assetType of ["prompt", "skill", "context"] as const) {
    const label = ASSET_TYPE_LABELS[assetType];
    if (label.toLowerCase().includes(queryLower) || assetType.toLowerCase().includes(queryLower)) {
      matchingFilters.push({
        type: "filter",
        filterKey: "assetType",
        filterValue: assetType,
        label: `Type: ${label}`,
      });
    }
  }

  const assetLimit = Math.max(1, limit - matchingFilters.length);
  const perTypeLimit = Math.ceil(assetLimit / 3);

  const searchTermOr = [
    { title: { contains: q, mode: "insensitive" as const } },
    { summary: { contains: q, mode: "insensitive" as const } },
  ];

  const [prompts, skills, contextDocs] = await Promise.all([
    prisma.prompt.findMany({
      where: {
        status: "PUBLISHED",
        AND: [
          buildVisibilityWhereFragment(auth) as Prisma.PromptWhereInput,
          { OR: searchTermOr },
        ],
      },
      select: {
        id: true,
        title: true,
        tools: true,
      },
      orderBy: { updatedAt: "desc" },
      take: perTypeLimit,
    }),
    prisma.skill.findMany({
      where: {
        status: "PUBLISHED",
        AND: [
          buildVisibilityWhereFragment(auth) as Prisma.SkillWhereInput,
          { OR: searchTermOr },
        ],
      },
      select: {
        id: true,
        title: true,
        tools: true,
      },
      orderBy: { updatedAt: "desc" },
      take: perTypeLimit,
    }),
    prisma.contextDocument.findMany({
      where: {
        status: "PUBLISHED",
        AND: [
          buildVisibilityWhereFragment(auth) as Prisma.ContextDocumentWhereInput,
          { OR: searchTermOr },
        ],
      },
      select: {
        id: true,
        title: true,
        tools: true,
      },
      orderBy: { updatedAt: "desc" },
      take: perTypeLimit,
    }),
  ]);

  const assetSuggestions: AssetSuggestion[] = [
    ...prompts.map((p) => ({
      type: "asset" as const,
      id: p.id,
      assetType: "prompt" as const,
      title: p.title,
      tool: p.tools[0] ?? null,
      label: p.title,
    })),
    ...skills.map((s) => ({
      type: "asset" as const,
      id: s.id,
      assetType: "skill" as const,
      title: s.title,
      tool: s.tools[0] ?? null,
      label: s.title,
    })),
    ...contextDocs.map((c) => ({
      type: "asset" as const,
      id: c.id,
      assetType: "context" as const,
      title: c.title,
      tool: c.tools[0] ?? null,
      label: c.title,
    })),
  ].slice(0, assetLimit);

  const response: SuggestionsResponse = {
    assets: assetSuggestions,
    filters: matchingFilters.slice(0, 5),
  };

  return res.status(200).json(response);
});

const parseQuerySchema = z.object({
  q: z.string().trim().min(1).max(500),
});

searchRouter.get("/parse", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const parsed = parseQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid request.",
        details: parsed.error.issues,
      },
    });
  }

  const { q } = parsed.data;

  try {
    const result = await parseSearchQuery(q);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(200).json({
      tool: null,
      assetType: null,
      modality: null,
      searchTerms: q.trim(),
    });
  }
});

export { searchRouter };
