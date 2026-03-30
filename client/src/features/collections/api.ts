import { apiClient } from "../../api/client";

export type Collection = {
  id: number;
  name: string;
  description: string | null;
  prompts: Array<{
    prompt: {
      id: number;
      title: string;
    };
  }>;
};

type ApiResponse<T> = {
  data: T;
};

export async function listCollections(): Promise<Collection[]> {
  const response = await apiClient.get<ApiResponse<Collection[]>>("/api/collections");
  return response.data.data;
}

export async function createCollection(payload: { name: string; description?: string }): Promise<Collection> {
  const response = await apiClient.post<ApiResponse<Collection>>("/api/collections", payload);
  return response.data.data;
}
