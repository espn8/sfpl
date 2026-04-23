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
  PROMPT_TOOL_OPTIONS as SKILL_TOOL_OPTIONS,
  PROMPT_TOOL_LABELS as SKILL_TOOL_LABELS,
  getToolsSortedAlphabetically as getSkillToolsSortedAlphabetically,
  getToolsSortedWithDynamic as getSkillToolsSortedWithDynamic,
  getToolLabel as getSkillToolLabel,
  fetchApprovedTools as fetchApprovedSkillTools,
};
export type { PromptTool as SkillTool };

export type SkillOwner = {
  id: number;
  name: string | null;
  avatarUrl: string | null;
};

export type SkillRating = {
  value: number;
};

export type Skill = {
  id: number;
  title: string;
  summary: string | null;
  skillUrl: string;
  supportUrl: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  tools: string[];
  thumbnailUrl?: string | null;
  thumbnailStatus?: "PENDING" | "READY" | "FAILED";
  thumbnailError?: string | null;
  createdAt: string;
  updatedAt: string;
  owner: SkillOwner;
  viewCount?: number;
  copyCount?: number;
  favoriteCount?: number;
  favorited?: boolean;
  myRating?: number | null;
  ratings?: SkillRating[];
  averageRating?: number | null;
  ratingCount?: number;
  isSmartPick?: boolean;
};

export type ListSkillsFilters = {
  q?: string;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  tool?: string;
  sort?: "recent" | "mostUsed";
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
  skillUrl: string;
  supportUrl?: string;
  visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  tools?: string[];
};

export async function createSkill(input: CreateSkillInput): Promise<Skill> {
  const { data } = await apiClient.post<{ data: Skill }>("/api/skills", input);
  return data.data;
}

export type UpdateSkillInput = Partial<{
  title: string;
  summary: string;
  skillUrl: string;
  supportUrl: string;
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  tools: string[];
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

export async function deleteSkillPermanently(skillId: number): Promise<void> {
  await apiClient.delete(`/api/skills/${skillId}/permanent`);
}

export async function regenerateSkillThumbnail(id: number): Promise<Skill> {
  const { data } = await apiClient.post<{ data: Skill }>(`/api/skills/${id}/regenerate-thumbnail`);
  return data.data;
}

export async function rateSkill(skillId: number, value: number): Promise<{ ok: boolean; value: number }> {
  const { data } = await apiClient.post<{ data: { ok: boolean; value: number } }>(`/api/skills/${skillId}/rating`, { value });
  return data.data;
}

export async function addSkillToCollection(skillId: number, collectionId: number): Promise<void> {
  await apiClient.post(`/api/skills/${skillId}/collections/${collectionId}`);
}

export async function removeSkillFromCollection(skillId: number, collectionId: number): Promise<void> {
  await apiClient.delete(`/api/skills/${skillId}/collections/${collectionId}`);
}

export const ARCHIVE_EXTENSIONS = [".zip", ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".7z", ".rar"];

export function isValidArchiveUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    return ARCHIVE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}
