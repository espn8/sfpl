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
};

type ApiResponse<T> = {
  data: T;
};

export async function listPrompts(): Promise<PromptSummary[]> {
  const response = await apiClient.get<ApiResponse<PromptSummary[]>>("/api/prompts");
  return response.data.data;
}

export async function getPrompt(id: number): Promise<Prompt> {
  const response = await apiClient.get<ApiResponse<Prompt>>(`/api/prompts/${id}`);
  return response.data.data;
}

export async function createPrompt(payload: {
  title: string;
  summary?: string;
  body: string;
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
