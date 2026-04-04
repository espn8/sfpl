import { apiClient } from "../../api/client";

export type AnalyticsOverview = {
  topUsedPrompts: Array<{ id: number; title: string; usageCount: number }>;
  topRatedPrompts: Array<{ id: number; title: string; averageRating: number | null; ratingCount: number }>;
  stalePrompts: Array<{ id: number; title: string; updatedAt: string }>;
  contributors: Array<{ id: number; email: string; name: string | null; promptCount: number }>;
  userEngagementLeaderboard: Array<{
    id: number;
    email: string;
    name: string | null;
    score: number;
    usedCount: number;
    favoritedCount: number;
    feedbackCount: number;
  }>;
};

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const response = await apiClient.get<{ data: AnalyticsOverview }>("/api/analytics/overview");
  return response.data.data;
}
