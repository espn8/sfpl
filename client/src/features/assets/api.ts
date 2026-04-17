import { apiClient } from "../../api/client";
import type { PromptTool } from "../prompts/api";

export type AssetType = "prompt" | "skill" | "context";

export type AssetOwner = {
  id: number;
  name: string | null;
  avatarUrl: string | null;
};

export type AssetVariable = {
  key: string;
  label: string | null;
  defaultValue: string | null;
  required: boolean;
};

export type UnifiedAsset = {
  id: number;
  assetType: AssetType;
  title: string;
  summary: string | null;
  body: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  tools: string[];
  createdAt: string;
  updatedAt: string;
  owner: AssetOwner;
  viewCount: number;
  usageCount: number;
  favorited: boolean;
  modality?: string;
  modelHint?: string | null;
  thumbnailUrl?: string | null;
  thumbnailStatus?: "PENDING" | "READY" | "FAILED";
  averageRating?: number | null;
  myRating?: number | null;
  variables?: AssetVariable[];
};

export type ListAssetsFilters = {
  q?: string;
  assetType?: "all" | AssetType;
  tool?: PromptTool;
  sort?: "recent" | "mostUsed";
  mine?: boolean;
  includeAnalytics?: boolean;
  page?: number;
  pageSize?: number;
};

export type ListAssetsSnapshot = {
  assetsPublished: number;
  promptsPublished: number;
  skillsPublished: number;
  contextPublished: number;
  activeUsers: number;
  promptsUsed: number;
};

export type ListAssetsFacets = {
  assetType: {
    prompt: number;
    skill: number;
    context: number;
  };
  tool: Record<string, number>;
};

export type ListAssetsResponse = {
  data: UnifiedAsset[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    facets?: ListAssetsFacets;
    snapshot: ListAssetsSnapshot;
  };
};

export async function listAssets(filters: ListAssetsFilters = {}): Promise<ListAssetsResponse> {
  const { data } = await apiClient.get<ListAssetsResponse>("/api/assets", { params: filters });
  return data;
}
