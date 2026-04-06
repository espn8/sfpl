import { apiClient } from "../../api/client";

export const PROMPT_TOOL_OPTIONS = ["cursor", "claude_code", "meshmesh", "slackbot", "gemini", "notebooklm"] as const;
export type PromptTool = (typeof PROMPT_TOOL_OPTIONS)[number];
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
  visibility: "PUBLIC" | "PRIVATE";
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
    promptsViewed: number;
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
  visibility?: "PUBLIC" | "PRIVATE";
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
