#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { AILibraryClient } from "./client.js";
const API_KEY = process.env.AI_LIBRARY_API_KEY;
const BASE_URL = process.env.AI_LIBRARY_BASE_URL || "https://ailibrary.example.com";
if (!API_KEY) {
    console.error("Error: AI_LIBRARY_API_KEY environment variable is required");
    process.exit(1);
}
const client = new AILibraryClient(API_KEY, BASE_URL);
const server = new Server({
    name: "ai-library",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "add_prompt",
                description: "Add a prompt to the AI Library. Prompts are reusable text templates for AI interactions.",
                inputSchema: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description: "The title of the prompt",
                        },
                        body: {
                            type: "string",
                            description: "The prompt content/template",
                        },
                        summary: {
                            type: "string",
                            description: "A brief description of what the prompt does (optional)",
                        },
                        tools: {
                            type: "array",
                            items: { type: "string" },
                            description: "Tools this prompt works with, e.g., ['cursor', 'chatgpt', 'claude_code']. Defaults to ['cursor']",
                        },
                        modality: {
                            type: "string",
                            enum: ["text", "code", "image", "video", "audio", "multimodal"],
                            description: "The type of content this prompt generates. Defaults to 'text'",
                        },
                        visibility: {
                            type: "string",
                            enum: ["PUBLIC", "TEAM", "PRIVATE"],
                            description: "Who can see this prompt. Defaults to 'PUBLIC'",
                        },
                        publish: {
                            type: "boolean",
                            description: "Publish immediately (true) or save as draft (false). Defaults to false",
                        },
                    },
                    required: ["title", "body"],
                },
            },
            {
                name: "add_skill",
                description: "Add a skill to the AI Library. Skills are packaged capabilities (like Cursor skills) distributed as archive files.",
                inputSchema: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description: "The title of the skill",
                        },
                        skillUrl: {
                            type: "string",
                            description: "URL to the skill archive file (.zip, .tar.gz, etc.)",
                        },
                        summary: {
                            type: "string",
                            description: "A brief description of what the skill does (optional)",
                        },
                        supportUrl: {
                            type: "string",
                            description: "URL for support/documentation (optional)",
                        },
                        tools: {
                            type: "array",
                            items: { type: "string" },
                            description: "Tools this skill works with. Defaults to ['cursor']",
                        },
                        visibility: {
                            type: "string",
                            enum: ["PUBLIC", "TEAM", "PRIVATE"],
                            description: "Who can see this skill. Defaults to 'PUBLIC'",
                        },
                        publish: {
                            type: "boolean",
                            description: "Publish immediately (true) or save as draft (false). Defaults to false",
                        },
                    },
                    required: ["title", "skillUrl"],
                },
            },
            {
                name: "add_context",
                description: "Add a context document to the AI Library. Context documents provide reference information for AI tools.",
                inputSchema: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description: "The title of the context document",
                        },
                        body: {
                            type: "string",
                            description: "The content of the context document",
                        },
                        summary: {
                            type: "string",
                            description: "A brief description of this context (optional)",
                        },
                        tools: {
                            type: "array",
                            items: { type: "string" },
                            description: "Tools this context works with. Defaults to ['cursor']",
                        },
                        visibility: {
                            type: "string",
                            enum: ["PUBLIC", "TEAM", "PRIVATE"],
                            description: "Who can see this context. Defaults to 'PUBLIC'",
                        },
                        publish: {
                            type: "boolean",
                            description: "Publish immediately (true) or save as draft (false). Defaults to false",
                        },
                    },
                    required: ["title", "body"],
                },
            },
            {
                name: "add_build",
                description: "Add a build to the AI Library. Builds are links to applications, tools, or resources built with AI.",
                inputSchema: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description: "The title of the build",
                        },
                        buildUrl: {
                            type: "string",
                            description: "URL to the build/application",
                        },
                        summary: {
                            type: "string",
                            description: "A brief description of this build (optional)",
                        },
                        supportUrl: {
                            type: "string",
                            description: "URL for support/documentation (optional)",
                        },
                        visibility: {
                            type: "string",
                            enum: ["PUBLIC", "TEAM", "PRIVATE"],
                            description: "Who can see this build. Defaults to 'PUBLIC'",
                        },
                        publish: {
                            type: "boolean",
                            description: "Publish immediately (true) or save as draft (false). Defaults to false",
                        },
                    },
                    required: ["title", "buildUrl"],
                },
            },
            {
                name: "whoami",
                description: "Get information about the authenticated user",
                inputSchema: {
                    type: "object",
                    properties: {},
                    required: [],
                },
            },
        ],
    };
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "add_prompt": {
                const input = args;
                const result = await client.createPrompt(input);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully added prompt "${result.title}" to the AI Library!\n\nID: ${result.id}\nStatus: ${result.status}\nURL: ${result.url}`,
                        },
                    ],
                };
            }
            case "add_skill": {
                const input = args;
                const result = await client.createSkill(input);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully added skill "${result.title}" to the AI Library!\n\nID: ${result.id}\nStatus: ${result.status}\nURL: ${result.url}`,
                        },
                    ],
                };
            }
            case "add_context": {
                const input = args;
                const result = await client.createContext(input);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully added context document "${result.title}" to the AI Library!\n\nID: ${result.id}\nStatus: ${result.status}\nURL: ${result.url}`,
                        },
                    ],
                };
            }
            case "add_build": {
                const input = args;
                const result = await client.createBuild(input);
                return {
                    content: [
                        {
                            type: "text",
                            text: `Successfully added build "${result.title}" to the AI Library!\n\nID: ${result.id}\nStatus: ${result.status}\nURL: ${result.url}`,
                        },
                    ],
                };
            }
            case "whoami": {
                const user = await client.getMe();
                return {
                    content: [
                        {
                            type: "text",
                            text: `Authenticated as:\n\nName: ${user.name || "Not set"}\nEmail: ${user.email}\nRole: ${user.role}\nTeam ID: ${user.teamId}`,
                        },
                    ],
                };
            }
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${message}`,
                },
            ],
            isError: true,
        };
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("AI Library MCP server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map