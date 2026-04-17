import { apiClient } from "../../api/client";

export const PROMPT_TOOL_OPTIONS = ["chatgpt", "claude_code", "claude_cowork", "cursor", "gemini", "meshmesh", "notebooklm", "other", "saleo", "slackbot"] as const;
export type PromptTool = (typeof PROMPT_TOOL_OPTIONS)[number];

export const PROMPT_TOOL_LABELS: Record<PromptTool, string> = {
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

export function getToolLabel(tool: PromptTool | string, dynamicToolLabels?: Map<string, string>): string {
  if (tool in PROMPT_TOOL_LABELS) {
    return PROMPT_TOOL_LABELS[tool as PromptTool];
  }
  return dynamicToolLabels?.get(tool) ?? tool;
}

export function getToolsSortedAlphabetically(): PromptTool[] {
  const sorted: PromptTool[] = [...PROMPT_TOOL_OPTIONS]
    .filter((t): t is Exclude<PromptTool, "other"> => t !== "other")
    .sort((a, b) => PROMPT_TOOL_LABELS[a].localeCompare(PROMPT_TOOL_LABELS[b]));
  return [...sorted, "other"];
}

export async function fetchApprovedTools(): Promise<string[]> {
  const response = await apiClient.get<{ data: string[] }>("/api/tool-requests/approved-tools");
  return response.data.data;
}

export function getToolsSortedWithDynamic(dynamicTools: string[]): string[] {
  const staticTools: string[] = [...PROMPT_TOOL_OPTIONS].filter((t) => t !== "other");
  const allTools = [...new Set([...staticTools, ...dynamicTools])];
  const sorted = allTools.sort((a, b) => {
    const labelA = a in PROMPT_TOOL_LABELS ? PROMPT_TOOL_LABELS[a as PromptTool] : a;
    const labelB = b in PROMPT_TOOL_LABELS ? PROMPT_TOOL_LABELS[b as PromptTool] : b;
    return labelA.localeCompare(labelB);
  });
  return [...sorted, "other"];
}

export const PROMPT_MODALITY_OPTIONS = ["text", "code", "image", "video", "audio", "multimodal"] as const;
export type PromptModality = (typeof PROMPT_MODALITY_OPTIONS)[number];

export type PromptSummaryVariable = {
  key: string;
  label: string | null;
  defaultValue: string | null;
  required: boolean;
};

export type PromptOwnerInfo = {
  id: number;
  name: string | null;
  avatarUrl: string | null;
};

export type PromptSummary = {
  id: number;
  title: string;
  summary: string | null;
  body: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  tools: PromptTool[];
  modality: PromptModality;
  createdAt: string;
  updatedAt: string;
  averageRating: number | null;
  usageCount: number;
  viewCount: number;
  favorited: boolean;
  myRating: number | null;
  owner: PromptOwnerInfo;
  tags: string[];
  modelHint?: string | null;
  thumbnailUrl?: string | null;
  thumbnailStatus: "PENDING" | "READY" | "FAILED";
  variables?: PromptSummaryVariable[];
};

export type PromptVariable = {
  id: number;
  promptId: number;
  key: string;
  label: string | null;
  defaultValue: string | null;
  required: boolean;
};

export type PromptVariableInput = {
  key: string;
  label?: string | null;
  defaultValue?: string | null;
  required?: boolean;
};

export type PromptVersionRow = {
  id: number;
  promptId: number;
  version: number;
  body: string;
  changelog: string | null;
  createdById: number;
  createdAt: string;
};

export type Prompt = {
  id: number;
  ownerId?: number;
  owner?: PromptOwnerInfo;
  createdAt: string;
  updatedAt: string;
  title: string;
  summary: string | null;
  body: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  tools: PromptTool[];
  modality: PromptModality;
  modelHint?: string | null;
  variables?: PromptVariable[];
  promptTags?: Array<{
    tag: {
      id: number;
      name: string;
    };
  }>;
  ratings?: Array<{
    value: number;
  }>;
  _count?: {
    favorites: number;
    usageEvents: number;
  };
  viewCount?: number;
  favorited?: boolean;
  myRating?: number | null;
  thumbnailUrl?: string | null;
  thumbnailStatus: "PENDING" | "READY" | "FAILED";
  thumbnailError?: string | null;
};

type ApiResponse<T> = {
  data: T;
};

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  snapshot?: {
    promptsPublished: number;
    activeUsers: number;
    promptsUsed: number;
  };
};

type ListPromptsResponse = {
  data: PromptSummary[];
  meta: ListMeta;
};

export type ListPromptsFilters = {
  q?: string;
  tag?: string;
  collectionId?: number;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  tool?: PromptTool;
  modality?: PromptModality;
  sort?: "recent" | "topRated" | "mostUsed";
  page?: number;
  pageSize?: number;
  mine?: boolean;
};

export async function listPrompts(filters: ListPromptsFilters = {}): Promise<ListPromptsResponse> {
  const response = await apiClient.get<ApiResponse<PromptSummary[]> & { meta: ListMeta }>("/api/prompts", {
    params: filters,
  });
  return {
    data: response.data.data,
    meta: response.data.meta,
  };
}

export async function getPrompt(id: number): Promise<Prompt> {
  const response = await apiClient.get<ApiResponse<Prompt>>(`/api/prompts/${id}`);
  return response.data.data;
}

export async function createPrompt(payload: {
  title: string;
  summary?: string;
  body: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
  tools: PromptTool[];
  modality: PromptModality;
  modelHint?: string;
  variables?: PromptVariableInput[];
}): Promise<Prompt> {
  const response = await apiClient.post<ApiResponse<Prompt>>("/api/prompts", payload);
  return response.data.data;
}

export async function replacePromptVariables(
  promptId: number,
  payload: { variables: PromptVariableInput[] },
): Promise<Prompt> {
  const response = await apiClient.put<ApiResponse<Prompt>>(`/api/prompts/${promptId}/variables`, payload);
  return response.data.data;
}

export async function updatePrompt(
  id: number,
  payload: Partial<Prompt> & { changelog?: string; tagIds?: number[] },
): Promise<Prompt> {
  const response = await apiClient.patch<ApiResponse<Prompt>>(`/api/prompts/${id}`, payload);
  return response.data.data;
}

export async function regeneratePromptThumbnail(id: number): Promise<Prompt> {
  const response = await apiClient.post<ApiResponse<Prompt>>(`/api/prompts/${id}/regenerate-thumbnail`);
  return response.data.data;
}

export async function createPromptVersion(
  id: number,
  payload: {
    body: string;
    changelog?: string;
  },
): Promise<Prompt & { latestVersion: number }> {
  const response = await apiClient.post<ApiResponse<Prompt & { latestVersion: number }>>(
    `/api/prompts/${id}/versions`,
    payload,
  );
  return response.data.data;
}

export async function listPromptVersions(promptId: number): Promise<PromptVersionRow[]> {
  const response = await apiClient.get<ApiResponse<PromptVersionRow[]>>(`/api/prompts/${promptId}/versions`);
  return response.data.data;
}

export async function restorePromptVersion(promptId: number, version: number): Promise<Prompt> {
  const response = await apiClient.post<ApiResponse<Prompt>>(`/api/prompts/${promptId}/restore/${version}`);
  return response.data.data;
}

export async function toggleFavorite(promptId: number): Promise<{ favorited: boolean }> {
  const response = await apiClient.post<ApiResponse<{ favorited: boolean }>>(`/api/prompts/${promptId}/favorite`);
  return response.data.data;
}

export async function ratePrompt(promptId: number, value: number): Promise<void> {
  await apiClient.post(`/api/prompts/${promptId}/rating`, { value });
}

export async function logUsage(promptId: number, action: "VIEW" | "COPY" | "LAUNCH"): Promise<void> {
  await apiClient.post(`/api/prompts/${promptId}/usage`, { action });
}

export async function deletePromptPermanently(promptId: number): Promise<void> {
  await apiClient.delete(`/api/prompts/${promptId}/permanent`);
}
