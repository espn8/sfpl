export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface CreatedResource {
  id: number;
  title: string;
  status: string;
  url: string;
  createdAt: string;
}

export interface CreatePromptInput {
  title: string;
  body: string;
  summary?: string;
  tools: string[];
  modality?: "text" | "code" | "image" | "video" | "audio" | "multimodal";
  visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
  publish?: boolean;
}

export interface CreateSkillInput {
  title: string;
  skillUrl: string;
  summary?: string;
  supportUrl?: string;
  tools: string[];
  modality?: "text" | "code" | "image" | "video" | "audio" | "multimodal";
  visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
  publish?: boolean;
}

export interface CreateContextInput {
  title: string;
  body: string;
  summary?: string;
  tools: string[];
  modality?: "text" | "code" | "image" | "video" | "audio" | "multimodal";
  visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
  publish?: boolean;
}

export interface CreateBuildInput {
  title: string;
  buildUrl: string;
  summary?: string;
  supportUrl?: string;
  modality?: "text" | "code" | "image" | "video" | "audio" | "multimodal";
  visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
  publish?: boolean;
}

export interface UserInfo {
  id: number;
  email: string;
  name: string | null;
  role: string;
  teamId: number;
}

export class AILibraryClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const errorData = data as ApiError;
      throw new Error(
        errorData.error?.message || `API request failed: ${response.status}`
      );
    }

    return (data as ApiResponse<T>).data;
  }

  async createPrompt(input: CreatePromptInput): Promise<CreatedResource> {
    return this.request<CreatedResource>("POST", "/api/v1/prompts", input);
  }

  async createSkill(input: CreateSkillInput): Promise<CreatedResource> {
    return this.request<CreatedResource>("POST", "/api/v1/skills", input);
  }

  async createContext(input: CreateContextInput): Promise<CreatedResource> {
    return this.request<CreatedResource>("POST", "/api/v1/context", input);
  }

  async createBuild(input: CreateBuildInput): Promise<CreatedResource> {
    return this.request<CreatedResource>("POST", "/api/v1/builds", input);
  }

  async getMe(): Promise<UserInfo> {
    return this.request<UserInfo>("GET", "/api/v1/me");
  }
}
