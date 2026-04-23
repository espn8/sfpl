export class AILibraryClient {
    apiKey;
    baseUrl;
    constructor(apiKey, baseUrl) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl.replace(/\/$/, "");
    }
    async request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        const headers = {
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
            const errorData = data;
            throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
        }
        return data.data;
    }
    async createPrompt(input) {
        return this.request("POST", "/api/v1/prompts", input);
    }
    async createSkill(input) {
        return this.request("POST", "/api/v1/skills", input);
    }
    async createContext(input) {
        return this.request("POST", "/api/v1/context", input);
    }
    async createBuild(input) {
        return this.request("POST", "/api/v1/builds", input);
    }
    async getMe() {
        return this.request("GET", "/api/v1/me");
    }
}
//# sourceMappingURL=client.js.map