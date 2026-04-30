import { apiClient } from "../../api/client";

export type HomeContributorRow = {
  id: number;
  email: string;
  name: string | null;
  assetCount: number;
};

export type HomeMostActiveRow = {
  id: number;
  email: string;
  name: string | null;
  score: number;
  firstPublishCount: number;
  viewCount: number;
  useCount: number;
  favoritedCount: number;
  collectionAddCount: number;
  ratingCount: number;
};

export type HomeLeaderboardsResponse = {
  contributors: HomeContributorRow[];
  mostActive: HomeMostActiveRow[];
};

export async function fetchHomeLeaderboards(): Promise<HomeLeaderboardsResponse> {
  const { data } = await apiClient.get<{ data: HomeLeaderboardsResponse }>("/api/home/leaderboards");
  return data.data;
}
