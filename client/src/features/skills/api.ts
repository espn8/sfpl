import { apiClient } from "../../api/client";

export type SkillOwner = {
  id: number;
  name: string | null;
  avatarUrl: string | null;
};

export type Skill = {
  id: number;
  title: string;
  summary: string | null;
  body: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  createdAt: string;
  updatedAt: string;
  owner: SkillOwner;
  viewCount?: number;
  copyCount?: number;
  favoriteCount?: number;
  favorited?: boolean;
};

export type ListSkillsFilters = {
  q?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  mine?: boolean;
  includeAnalytics?: boolean;
  page?: number;
  pageSize?: number;
};

export type ListSkillsResponse = {
  data: Skill[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

export async function listSkills(filters: ListSkillsFilters = {}): Promise<ListSkillsResponse> {
  const { data } = await apiClient.get<ListSkillsResponse>("/api/skills", { params: filters });
  return data;
}

export async function getSkill(id: number): Promise<Skill> {
  const { data } = await apiClient.get<{ data: Skill }>(`/api/skills/${id}`);
  return data.data;
}

export type CreateSkillInput = {
  title: string;
  summary?: string;
  body: string;
  visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

export async function createSkill(input: CreateSkillInput): Promise<Skill> {
  const { data } = await apiClient.post<{ data: Skill }>("/api/skills", input);
  return data.data;
}

export type UpdateSkillInput = Partial<{
  title: string;
  summary: string;
  body: string;
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}>;

export async function updateSkill(id: number, input: UpdateSkillInput): Promise<Skill> {
  const { data } = await apiClient.patch<{ data: Skill }>(`/api/skills/${id}`, input);
  return data.data;
}

export async function archiveSkill(id: number): Promise<void> {
  await apiClient.delete(`/api/skills/${id}`);
}

export async function toggleSkillFavorite(skillId: number): Promise<{ favorited: boolean }> {
  const { data } = await apiClient.post<{ data: { favorited: boolean } }>(`/api/skills/${skillId}/favorite`);
  return data.data;
}

export async function logSkillUsage(skillId: number, eventType: "VIEW" | "COPY"): Promise<void> {
  await apiClient.post(`/api/skills/${skillId}/usage`, { eventType });
}
