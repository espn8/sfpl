import { apiClient } from "../../api/client";

export type ApiKey = {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type ApiKeyWithFullKey = ApiKey & {
  key: string;
};

type ApiKeysResponse = {
  data: ApiKey[];
};

type CreateApiKeyResponse = {
  data: ApiKeyWithFullKey;
};

export async function fetchApiKeys(): Promise<ApiKey[]> {
  const response = await apiClient.get<ApiKeysResponse>("/api/api-keys");
  return response.data.data;
}

export async function createApiKey(name: string, expiresInDays?: number): Promise<ApiKeyWithFullKey> {
  const response = await apiClient.post<CreateApiKeyResponse>("/api/api-keys", {
    name,
    expiresInDays,
  });
  return response.data.data;
}

export async function revokeApiKey(id: number): Promise<void> {
  await apiClient.delete(`/api/api-keys/${id}`);
}
