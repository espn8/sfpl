import { apiClient } from "../../api/client";

export type AssetKindForRewrite = "prompt" | "skill" | "context" | "build";

export type SummaryRewriteInput = {
  draft: string;
  title?: string;
  assetType: AssetKindForRewrite;
};

export type SummaryRewriteResponse = {
  summary: string;
};

export async function rewriteSummary(input: SummaryRewriteInput): Promise<SummaryRewriteResponse> {
  const response = await apiClient.post<SummaryRewriteResponse>("/api/ai/summary-rewrite", input);
  return response.data;
}
