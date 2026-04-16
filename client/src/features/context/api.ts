import { apiClient } from "../../api/client";

export type ContextOwner = {
  id: number;
  name: string | null;
  avatarUrl: string | null;
};

export type ContextDocument = {
  id: number;
  title: string;
  summary: string | null;
  body: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  createdAt: string;
  updatedAt: string;
  owner: ContextOwner;
  viewCount?: number;
  copyCount?: number;
  favoriteCount?: number;
  favorited?: boolean;
};

export type ListContextFilters = {
  q?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
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

export type CreateContextInput = {
  title: string;
  summary?: string;
  body: string;
  visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
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
