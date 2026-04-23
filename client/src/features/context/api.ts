import { apiClient } from "../../api/client";
import {
  PROMPT_TOOL_OPTIONS,
  PROMPT_TOOL_LABELS,
  getToolsSortedAlphabetically,
  getToolsSortedWithDynamic,
  getToolLabel,
  fetchApprovedTools,
} from "../prompts/api";
import type { PromptTool } from "../prompts/api";

export {
  PROMPT_TOOL_OPTIONS as CONTEXT_TOOL_OPTIONS,
  PROMPT_TOOL_LABELS as CONTEXT_TOOL_LABELS,
  getToolsSortedAlphabetically as getContextToolsSortedAlphabetically,
  getToolsSortedWithDynamic as getContextToolsSortedWithDynamic,
  getToolLabel as getContextToolLabel,
  fetchApprovedTools as fetchApprovedContextTools,
};
export type { PromptTool as ContextTool };

export type ContextOwner = {
  id: number;
  name: string | null;
  avatarUrl: string | null;
};

export type ContextVariable = {
  id: number;
  key: string;
  label: string | null;
  defaultValue: string | null;
  required: boolean;
};

export type ContextRating = {
  value: number;
};

export type ContextDocument = {
  id: number;
  title: string;
  summary: string | null;
  body: string;
  supportUrl?: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  tools: string[];
  thumbnailUrl?: string | null;
  thumbnailStatus?: "PENDING" | "READY" | "FAILED";
  thumbnailError?: string | null;
  createdAt: string;
  updatedAt: string;
  owner: ContextOwner;
  variables?: ContextVariable[];
  viewCount?: number;
  copyCount?: number;
  favoriteCount?: number;
  favorited?: boolean;
  myRating?: number | null;
  ratings?: ContextRating[];
  averageRating?: number | null;
  ratingCount?: number;
  isSmartPick?: boolean;
};

export type ListContextFilters = {
  q?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  tool?: string;
  sort?: "recent" | "mostUsed";
  mine?: boolean;
  includeAnalytics?: boolean;
  page?: number;
  pageSize?: number;
};

export type ListContextResponse = {
  data: ContextDocument[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

export async function listContext(filters: ListContextFilters = {}): Promise<ListContextResponse> {
  const { data } = await apiClient.get<ListContextResponse>("/api/context", { params: filters });
  return data;
}

export async function getContextDocument(id: number): Promise<ContextDocument> {
  const { data } = await apiClient.get<{ data: ContextDocument }>(`/api/context/${id}`);
  return data.data;
}

export type ContextVariableInput = {
  key: string;
  label?: string | null;
  defaultValue?: string | null;
  required?: boolean;
};

export type CreateContextInput = {
  title: string;
  summary?: string;
  body: string;
  visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  tools?: string[];
  variables?: ContextVariableInput[];
};

export async function createContextDocument(input: CreateContextInput): Promise<ContextDocument> {
  const { data } = await apiClient.post<{ data: ContextDocument }>("/api/context", input);
  return data.data;
}

export type UpdateContextInput = Partial<{
  title: string;
  summary: string;
  body: string;
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  tools: string[];
}>;

export async function updateContextDocument(id: number, input: UpdateContextInput): Promise<ContextDocument> {
  const { data } = await apiClient.patch<{ data: ContextDocument }>(`/api/context/${id}`, input);
  return data.data;
}

export async function archiveContextDocument(id: number): Promise<void> {
  await apiClient.delete(`/api/context/${id}`);
}

export async function toggleContextFavorite(contextId: number): Promise<{ favorited: boolean }> {
  const { data } = await apiClient.post<{ data: { favorited: boolean } }>(`/api/context/${contextId}/favorite`);
  return data.data;
}

export async function logContextUsage(contextId: number, eventType: "VIEW" | "COPY"): Promise<void> {
  await apiClient.post(`/api/context/${contextId}/usage`, { eventType });
}

export async function replaceContextVariables(
  contextId: number,
  variables: ContextVariableInput[],
): Promise<ContextDocument> {
  const { data } = await apiClient.put<{ data: ContextDocument }>(`/api/context/${contextId}/variables`, { variables });
  return data.data;
}

export async function deleteContextDocumentPermanently(contextId: number): Promise<void> {
  await apiClient.delete(`/api/context/${contextId}/permanent`);
}

export async function regenerateContextThumbnail(id: number): Promise<ContextDocument> {
  const { data } = await apiClient.post<{ data: ContextDocument }>(`/api/context/${id}/regenerate-thumbnail`);
  return data.data;
}

export async function rateContext(contextId: number, value: number): Promise<{ ok: boolean; value: number }> {
  const { data } = await apiClient.post<{ data: { ok: boolean; value: number } }>(`/api/context/${contextId}/rating`, { value });
  return data.data;
}

export async function addContextToCollection(contextId: number, collectionId: number): Promise<void> {
  await apiClient.post(`/api/context/${contextId}/collections/${collectionId}`);
}

export async function removeContextFromCollection(contextId: number, collectionId: number): Promise<void> {
  await apiClient.delete(`/api/context/${contextId}/collections/${collectionId}`);
}
