import { apiClient } from "../../api/client";

export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  teamId: number;
};

type MeResponse = {
  data: AuthUser;
};

export async function fetchMe(): Promise<AuthUser> {
  const response = await apiClient.get<MeResponse>("/api/auth/me");
  return response.data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/api/auth/logout");
}

export function getGoogleLoginUrl(): string {
  return `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/auth/google/start`;
}
