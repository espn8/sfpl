import { apiClient } from "../../api/client";

export type BuildOwner = {
  id: number;
  name: string | null;
  avatarUrl: string | null;
};

export type BuildRating = {
  value: number;
};

export type Build = {
  id: number;
  title: string;
  summary: string | null;
  buildUrl: string;
  supportUrl: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  thumbnailUrl?: string | null;
  thumbnailStatus?: "PENDING" | "READY" | "FAILED";
  thumbnailError?: string | null;
  createdAt: string;
  updatedAt: string;
  owner: BuildOwner;
  viewCount?: number;
  copyCount?: number;
  favoriteCount?: number;
  favorited?: boolean;
  myRating?: number | null;
  ratings?: BuildRating[];
  averageRating?: number | null;
  ratingCount?: number;
  isSmartPick?: boolean;
  flagCounts?: Record<string, number>;
  lastVerifiedAt?: string | null;
  verificationDueAt?: string | null;
  archivedAt?: string | null;
  archiveReason?: "MANUAL" | "UNVERIFIED" | "INACTIVE" | "LOW_RATING" | "PROFILE_INCOMPLETE" | null;
};

export type ListBuildsFilters = {
  q?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sort?: "recent" | "mostUsed";
  mine?: boolean;
  includeAnalytics?: boolean;
  page?: number;
  pageSize?: number;
};

export type ListBuildsResponse = {
  data: Build[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

export async function listBuilds(filters: ListBuildsFilters = {}): Promise<ListBuildsResponse> {
  const { data } = await apiClient.get<ListBuildsResponse>("/api/builds", { params: filters });
  return data;
}

export async function getBuild(id: number): Promise<Build> {
  const { data } = await apiClient.get<{ data: Build }>(`/api/builds/${id}`);
  return data.data;
}

export type CreateBuildInput = {
  title: string;
  summary?: string;
  buildUrl: string;
  supportUrl?: string;
  visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  skipThumbnailGeneration?: boolean;
};

export async function createBuild(input: CreateBuildInput): Promise<Build> {
  const { data } = await apiClient.post<{ data: Build }>("/api/builds", input);
  return data.data;
}

export type UpdateBuildInput = {
  title?: string;
  summary?: string;
  buildUrl?: string;
  supportUrl?: string;
  visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

export async function updateBuild(id: number, input: UpdateBuildInput): Promise<Build> {
  const { data } = await apiClient.patch<{ data: Build }>(`/api/builds/${id}`, input);
  return data.data;
}

export async function archiveBuild(id: number): Promise<Build> {
  const { data } = await apiClient.delete<{ data: Build }>(`/api/builds/${id}`);
  return data.data;
}

export async function deleteBuildPermanently(id: number): Promise<{ deleted: boolean; id: number }> {
  const { data } = await apiClient.delete<{ data: { deleted: boolean; id: number } }>(`/api/builds/${id}/permanent`);
  return data.data;
}

export async function toggleBuildFavorite(id: number): Promise<{ favorited: boolean }> {
  const { data } = await apiClient.post<{ data: { favorited: boolean } }>(`/api/builds/${id}/favorite`);
  return data.data;
}

export async function logBuildUsage(id: number, eventType: "VIEW" | "COPY"): Promise<void> {
  await apiClient.post(`/api/builds/${id}/usage`, { eventType });
}

export async function rateBuild(
  id: number,
  value: number,
  options?: { feedbackFlags?: string[]; comment?: string }
): Promise<void> {
  await apiClient.post(`/api/builds/${id}/rating`, {
    value,
    ...(options?.feedbackFlags && options.feedbackFlags.length > 0
      ? { feedbackFlags: options.feedbackFlags }
      : {}),
    ...(options?.comment ? { comment: options.comment } : {}),
  });
}

export async function regenerateBuildThumbnail(id: number): Promise<{ id: number; thumbnailStatus: string }> {
  const { data } = await apiClient.post<{ data: { id: number; thumbnailStatus: string } }>(
    `/api/builds/${id}/regenerate-thumbnail`
  );
  return data.data;
}

export async function uploadBuildThumbnail(id: number, file: File): Promise<Build> {
  const formData = new FormData();
  formData.append("thumbnail", file);
  const { data } = await apiClient.post<{ data: Build }>(`/api/builds/${id}/thumbnail`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data.data;
}

export async function addBuildToCollection(buildId: number, collectionId: number): Promise<void> {
  await apiClient.post(`/api/builds/${buildId}/collections/${collectionId}`);
}

export async function removeBuildFromCollection(buildId: number, collectionId: number): Promise<void> {
  await apiClient.delete(`/api/builds/${buildId}/collections/${collectionId}`);
}
