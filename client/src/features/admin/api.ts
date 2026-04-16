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
