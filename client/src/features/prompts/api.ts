import { apiClient } from "../../api/client";

export type PromptSummary = {
  id: number;
  title: string;
  summary: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  averageRating: number | null;
  usageCount: number;
};

export type Prompt = {
  id: number;
  title: string;
  summary: string | null;
  body: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibility: "TEAM" | "PRIVATE";
  modelHint?: string | null;
  modality?: string | null;
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
};

type ApiResponse<T> = {
  data: T;
};

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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
  visibility?: "TEAM" | "PRIVATE";
  modelHint?: string;
  modality?: string;
}): Promise<Prompt> {
  const response = await apiClient.post<ApiResponse<Prompt>>("/api/prompts", payload);
  return response.data.data;
}

export async function updatePrompt(id: number, payload: Partial<Prompt> & { changelog?: string }): Promise<Prompt> {
  const response = await apiClient.patch<ApiResponse<Prompt>>(`/api/prompts/${id}`, payload);
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
