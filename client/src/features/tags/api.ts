import { apiClient } from "../../api/client";

export type Tag = {
  id: number;
  name: string;
  promptCount: number;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse<T> = {
  data: T;
};

export async function listTags(): Promise<Tag[]> {
  const response = await apiClient.get<ApiResponse<Tag[]>>("/api/tags");
  return response.data.data;
}

export async function createTag(name: string): Promise<Tag> {
  const response = await apiClient.post<ApiResponse<Tag>>("/api/tags", { name });
  return response.data.data;
}
