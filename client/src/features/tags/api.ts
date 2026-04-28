import { apiClient } from "../../api/client";

export type Tag = {
  id: number;
  name: string;
  usageCount: number;
  promptCount: number;
  skillCount: number;
  contextCount: number;
  buildCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ListTagsParams = { q?: string; limit?: number };

type ApiResponse<T> = {
  data: T;
};

export async function listTags(params?: ListTagsParams): Promise<Tag[]> {
  const response = await apiClient.get<ApiResponse<Tag[]>>("/api/tags", { params: params ?? {} });
  return response.data.data;
}

export async function createTag(name: string): Promise<Tag> {
  const response = await apiClient.post<ApiResponse<Tag>>("/api/tags", { name });
  return response.data.data;
}

export type TagRequestStatus = "PENDING" | "APPROVED" | "DECLINED" | "ON_HOLD";

export type TagRequest = {
  id: number;
  requestedName: string;
  description: string | null;
  submitterFirstName: string;
  submitterLastName: string;
  submitterEmail: string;
  status: TagRequestStatus;
  reviewedAt: string | null;
  reviewedById: number | null;
  reviewedBy: { id: number; name: string | null; email: string } | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ListTagRequestsFilters = {
  status?: TagRequestStatus;
  page?: number;
  pageSize?: number;
};

export async function submitTagRequest(input: {
  requestedName: string;
  description?: string;
  submitterFirstName: string;
  submitterLastName: string;
}): Promise<TagRequest> {
  const { data } = await apiClient.post<{ data: TagRequest }>("/api/tag-requests", input);
  return data.data;
}

export async function listTagRequests(
  filters: ListTagRequestsFilters = {},
): Promise<{ data: TagRequest[]; meta: ListMeta }> {
  const { data } = await apiClient.get<{ data: TagRequest[]; meta: ListMeta }>("/api/tag-requests", {
    params: filters,
  });
  return data;
}

export type ReviewTagRequestInput = {
  status: "APPROVED" | "DECLINED" | "ON_HOLD";
  reviewNotes?: string;
};

export async function reviewTagRequest(id: number, input: ReviewTagRequestInput): Promise<TagRequest> {
  const { data } = await apiClient.patch<{ data: TagRequest }>(`/api/tag-requests/${id}`, input);
  return data.data;
}
