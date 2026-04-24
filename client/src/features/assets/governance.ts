import { apiClient } from "../../api/client";
import type { AssetType, ArchiveReason } from "./api";

export type VerificationState = "verified" | "warning" | "overdue" | "none";

const WARNING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function getVerificationState(
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
  verificationDueAt: string | null | undefined,
): VerificationState {
  if (status !== "PUBLISHED") return "none";
  if (!verificationDueAt) return "none";
  const due = new Date(verificationDueAt).getTime();
  if (!Number.isFinite(due)) return "none";
  const now = Date.now();
  if (due < now) return "overdue";
  if (due - now <= WARNING_WINDOW_MS) return "warning";
  return "verified";
}

export function formatDaysAgo(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const ts = new Date(dateString).getTime();
  if (!Number.isFinite(ts)) return null;
  const diffMs = Date.now() - ts;
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

export function formatDaysUntil(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const ts = new Date(dateString).getTime();
  if (!Number.isFinite(ts)) return null;
  const diffMs = ts - Date.now();
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (days <= 0) return "overdue";
  if (days === 1) return "1d";
  return `${days}d`;
}

export function archiveReasonLabel(reason: ArchiveReason | null | undefined): string | null {
  switch (reason) {
    case "MANUAL":
      return "Archived by owner";
    case "UNVERIFIED":
      return "Archived: not re-verified";
    case "INACTIVE":
      return "Archived: inactive 30+ days";
    case "LOW_RATING":
      return "Archived: low rating";
    case "PROFILE_INCOMPLETE":
      return "Archived: profile setup incomplete";
    default:
      return null;
  }
}

function routeBase(assetType: AssetType): string {
  switch (assetType) {
    case "prompt":
      return "/api/prompts";
    case "skill":
      return "/api/skills";
    case "context":
      return "/api/context";
    case "build":
      return "/api/builds";
  }
}

export async function verifyAssetApi(assetType: AssetType, id: number): Promise<void> {
  await apiClient.post(`${routeBase(assetType)}/${id}/verify`);
}

export async function unarchiveAssetApi(assetType: AssetType, id: number): Promise<void> {
  await apiClient.post(`${routeBase(assetType)}/${id}/unarchive`);
}

export async function transferOwnerApi(
  assetType: AssetType,
  id: number,
  newOwnerId: number,
  reason?: string,
): Promise<void> {
  await apiClient.post(`${routeBase(assetType)}/${id}/transfer-owner`, {
    newOwnerId,
    ...(reason ? { reason } : {}),
  });
}

export type NeedsVerificationResponse = {
  data: {
    prompts: Array<NeedsVerificationAsset>;
    skills: Array<NeedsVerificationAsset>;
    contexts: Array<NeedsVerificationAsset>;
    builds: Array<NeedsVerificationAsset>;
  };
};

export type NeedsVerificationAsset = {
  id: number;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  lastVerifiedAt: string | null;
  verificationDueAt: string | null;
  updatedAt: string;
};

export async function fetchNeedsVerification(windowDays = 7): Promise<NeedsVerificationResponse["data"]> {
  const { data } = await apiClient.get<NeedsVerificationResponse>(`/api/me/assets/needs-verification`, {
    params: { window: windowDays },
  });
  return data.data;
}
