import { apiClient } from "../../api/client";

export type Collection = {
  id: number;
  name: string;
  description: string | null;
  prompts: Array<{
    prompt: {
      id: number;
      title: string;
      thumbnailUrl?: string | null;
      thumbnailStatus?: "PENDING" | "READY" | "FAILED";
    };
  }>;
  skills: Array<{
    skill: {
      id: number;
      title: string;
      thumbnailUrl?: string | null;
      thumbnailStatus?: "PENDING" | "READY" | "FAILED";
    };
  }>;
  contexts: Array<{
    context: {
      id: number;
      title: string;
      thumbnailUrl?: string | null;
      thumbnailStatus?: "PENDING" | "READY" | "FAILED";
    };
  }>;
  builds?: Array<{
    build: {
      id: number;
      title: string;
      thumbnailUrl?: string | null;
      thumbnailStatus?: "PENDING" | "READY" | "FAILED";
    };
  }>;
};

export type CollectionListResponse = {
  data: Collection[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type ApiResponse<T> = {
  data: T;
};

export async function listCollections(): Promise<Collection[]> {
  const response = await apiClient.get<CollectionListResponse>("/api/collections");
  return response.data.data;
}

export async function createCollection(payload: { name: string; description?: string }): Promise<Collection> {
  const response = await apiClient.post<ApiResponse<Collection>>("/api/collections", payload);
  return response.data.data;
}

export async function getCollection(collectionId: number): Promise<Collection> {
  const response = await apiClient.get<ApiResponse<Collection>>(`/api/collections/${collectionId}`);
  return response.data.data;
}

export async function updateCollection(
  collectionId: number,
  payload: { name?: string; description?: string },
): Promise<Collection> {
  const response = await apiClient.patch<ApiResponse<Collection>>(`/api/collections/${collectionId}`, payload);
  return response.data.data;
}

export async function deleteCollection(collectionId: number): Promise<void> {
  await apiClient.delete(`/api/collections/${collectionId}`);
}

export async function addPromptToCollection(collectionId: number, promptId: number): Promise<void> {
  await apiClient.post(`/api/collections/${collectionId}/prompts/${promptId}`);
}

export async function removePromptFromCollection(collectionId: number, promptId: number): Promise<void> {
  await apiClient.delete(`/api/collections/${collectionId}/prompts/${promptId}`);
}
