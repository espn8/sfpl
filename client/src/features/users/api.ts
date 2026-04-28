import { apiClient } from "../../api/client";

export type PublicUserProfile = {
  id: number;
  name: string | null;
  avatarUrl: string | null;
  ou: string | null;
  region: string | null;
  title: string | null;
  collectionAddsCount: number;
  favoriteCount: number;
  favoritedByMe: boolean;
};

type ApiResponse<T> = { data: T };

export async function fetchUserProfile(userId: number): Promise<PublicUserProfile> {
  const { data } = await apiClient.get<ApiResponse<PublicUserProfile>>(`/api/users/${userId}`);
  return data.data;
}

export async function toggleUserFavorite(userId: number): Promise<{ favorited: boolean }> {
  const { data } = await apiClient.post<ApiResponse<{ favorited: boolean }>>(`/api/users/${userId}/favorite`);
  return data.data;
}
