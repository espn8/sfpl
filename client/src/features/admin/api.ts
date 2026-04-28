import { apiClient } from "../../api/client";

export type ToolRequestStatus = "PENDING" | "APPROVED" | "DECLINED" | "ON_HOLD";

export type ToolRequest = {
  id: number;
  name: string;
  salesforceApproved: boolean;
  detailsUrl: string;
  description: string;
  submitterFirstName: string;
  submitterLastName: string;
  submitterEmail: string;
  status: ToolRequestStatus;
  reviewedAt: string | null;
  reviewedById: number | null;
  reviewedBy: {
    id: number;
    name: string | null;
    email: string;
  } | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ListToolRequestsResponse = {
  data: ToolRequest[];
  meta: ListMeta;
};

export type ListToolRequestsFilters = {
  status?: ToolRequestStatus;
  page?: number;
  pageSize?: number;
};

export async function listToolRequests(filters: ListToolRequestsFilters = {}): Promise<ListToolRequestsResponse> {
  const response = await apiClient.get<ListToolRequestsResponse>("/api/tool-requests", {
    params: filters,
  });
  return response.data;
}

export type ReviewToolRequestInput = {
  status: "APPROVED" | "DECLINED" | "ON_HOLD";
  reviewNotes?: string;
};

export async function reviewToolRequest(id: number, input: ReviewToolRequestInput): Promise<ToolRequest> {
  const response = await apiClient.patch<{ data: ToolRequest }>(`/api/tool-requests/${id}`, input);
  return response.data.data;
}

export type AdminUser = {
  id: number;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  role: string;
};

export type AdminUserAsset = {
  id: number;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: string;
  verificationDueAt: string | null;
  archivedAt: string | null;
  archiveReason: "MANUAL" | "UNVERIFIED" | "INACTIVE" | "LOW_RATING" | "PROFILE_INCOMPLETE" | null;
};

export type AdminUserAssetsResponse = {
  data: {
    user: { id: number; name: string | null; email: string; role: string };
    prompts: AdminUserAsset[];
    skills: AdminUserAsset[];
    contexts: AdminUserAsset[];
    builds: AdminUserAsset[];
    totals: { prompts: number; skills: number; contexts: number; builds: number; total: number };
  };
};

export async function listAdminUsers(q?: string): Promise<AdminUser[]> {
  const { data } = await apiClient.get<{ data: AdminUser[] }>("/api/admin/users", {
    params: q ? { q } : undefined,
  });
  return data.data;
}

export async function listUserAssets(userId: number): Promise<AdminUserAssetsResponse["data"]> {
  const { data } = await apiClient.get<AdminUserAssetsResponse>(`/api/admin/users/${userId}/assets`);
  return data.data;
}

export type TransferAssetsInput = {
  newOwnerId: number;
  includeStatuses?: Array<"DRAFT" | "PUBLISHED" | "ARCHIVED">;
  assetTypes?: Array<"PROMPT" | "SKILL" | "CONTEXT" | "BUILD">;
  reason?: string;
};

export async function transferUserAssets(
  userId: number,
  input: TransferAssetsInput,
): Promise<{ fromUserId: number; toUserId: number; transferred: Record<string, number>; total: number }> {
  const { data } = await apiClient.post<{
    data: { fromUserId: number; toUserId: number; transferred: Record<string, number>; total: number };
  }>(`/api/admin/users/${userId}/transfer-assets`, input);
  return data.data;
}

export async function runGovernanceSweep(dryRun = false): Promise<Record<string, unknown>> {
  const { data } = await apiClient.post<{ data: Record<string, unknown> }>(
    `/api/admin/governance/run`,
    {},
    { params: dryRun ? { dryRun: true } : undefined },
  );
  return data.data;
}

export type CustomDepartmentOuRow = { ou: string; userCount: number };

export async function listCustomDepartmentOusInUse(): Promise<CustomDepartmentOuRow[]> {
  const { data } = await apiClient.get<{ data: { rows: CustomDepartmentOuRow[] } }>(
    "/api/admin/department-ous/custom-in-use",
  );
  return data.data.rows;
}
