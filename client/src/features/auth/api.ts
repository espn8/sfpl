import { apiClient } from "../../api/client";

export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  region: string | null;
  ou: string | null;
  title: string | null;
  onboardingCompleted: boolean;
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

type UpdateProfileInput = {
  name: string;
  avatarUrl: string;
  region: string;
  ou: string;
  title: string;
};

export async function updateMyProfile(input: UpdateProfileInput): Promise<AuthUser> {
  const response = await apiClient.patch<MeResponse>("/api/auth/me", input);
  return response.data.data;
}

export async function uploadProfilePhoto(file: File): Promise<AuthUser> {
  const formData = new FormData();
  formData.append("profilePhoto", file);
  const response = await apiClient.post<MeResponse>("/api/auth/me/profile-photo", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/api/auth/logout");
}

export function getGoogleLoginUrl(): string {
  return `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/auth/google/start`;
}
