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
    tools?: string[];
    modality?: "text" | "code" | "image" | "video" | "audio" | "multimodal";
    visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
    publish?: boolean;
}
export interface CreateSkillInput {
    title: string;
    skillUrl: string;
    summary?: string;
    supportUrl?: string;
    tools?: string[];
    visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
    publish?: boolean;
}
export interface CreateContextInput {
    title: string;
    body: string;
    summary?: string;
    tools?: string[];
    visibility?: "PUBLIC" | "TEAM" | "PRIVATE";
    publish?: boolean;
}
export interface CreateBuildInput {
    title: string;
    buildUrl: string;
    summary?: string;
    supportUrl?: string;
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
export declare class AILibraryClient {
    private apiKey;
    private baseUrl;
    constructor(apiKey: string, baseUrl: string);
    private request;
    createPrompt(input: CreatePromptInput): Promise<CreatedResource>;
    createSkill(input: CreateSkillInput): Promise<CreatedResource>;
    createContext(input: CreateContextInput): Promise<CreatedResource>;
    createBuild(input: CreateBuildInput): Promise<CreatedResource>;
    getMe(): Promise<UserInfo>;
}
//# sourceMappingURL=client.d.ts.map