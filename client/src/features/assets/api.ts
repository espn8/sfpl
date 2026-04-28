import { apiClient } from "../../api/client";
import type { PromptTool } from "../prompts/api";

export type AssetType = "prompt" | "skill" | "context" | "build";

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

export type FeedbackFlag = "WORKED_WELL" | "DID_NOT_WORK" | "INACCURATE" | "OUTDATED" | "OFF_TOPIC";
export type ArchiveReason = "MANUAL" | "UNVERIFIED" | "INACTIVE" | "LOW_RATING" | "PROFILE_INCOMPLETE";

export type UnifiedAsset = {
  id: number;
  assetType: AssetType;
  title: string;
  summary: string | null;
  /**
   * Populated only for builds (the build URL). For prompts and context documents
   * this is omitted from the list response to keep the payload small; fetch the
   * full detail endpoint (getPrompt / getContextDocument) on demand.
   */
  body?: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  tools: string[];
  createdAt: string;
  updatedAt: string;
  owner: AssetOwner;
  viewCount: number;
  usageCount: number;
  favorited: boolean;
  favoriteCount: number;
  ratingCount?: number;
  modality?: string;
  modelHint?: string | null;
  thumbnailUrl?: string | null;
  thumbnailStatus?: "PENDING" | "READY" | "FAILED";
  averageRating?: number | null;
  myRating?: number | null;
  variables?: AssetVariable[];
  isSmartPick?: boolean;
  tags?: string[];
  flagCounts?: Partial<Record<FeedbackFlag, number>>;
  lastVerifiedAt?: string | null;
  verificationDueAt?: string | null;
  archivedAt?: string | null;
  archiveReason?: ArchiveReason | null;
};

export type ListAssetsFilters = {
  q?: string;
  assetType?: "all" | AssetType;
  tool?: PromptTool;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sort?: "recent" | "mostUsed" | "name" | "updatedAt";
  mine?: boolean;
  ownerId?: number;
  includeAnalytics?: boolean;
  page?: number;
  pageSize?: number;
  snapshot?: boolean;
  /** Global tag name; matches server `GET /api/assets?tag=`. */
  tag?: string;
};

export type ListAssetsSnapshot = {
  assetsPublished: number;
  promptsPublished: number;
  skillsPublished: number;
  contextPublished: number;
  buildsPublished: number;
  activeUsers: number;
  promptsUsed: number;
};

export type ListAssetsFacets = {
  assetType: {
    prompt: number;
    skill: number;
    context: number;
    build: number;
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
    snapshot?: ListAssetsSnapshot;
  };
};

export async function listAssets(filters: ListAssetsFilters = {}): Promise<ListAssetsResponse> {
  const { data } = await apiClient.get<ListAssetsResponse>("/api/assets", { params: filters });
  return data;
}
