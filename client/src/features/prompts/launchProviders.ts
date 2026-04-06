import type { PromptTool } from "./api";

export const LAUNCH_PROVIDER_IDS = ["chatgpt", "claude", "gemini"] as const;
export type LaunchProviderId = (typeof LAUNCH_PROVIDER_IDS)[number];

export function defaultLaunchProviderForTools(tools: readonly PromptTool[]): LaunchProviderId {
  if (tools.includes("gemini")) {
    return "gemini";
  }
  if (tools.includes("claude_code")) {
    return "claude";
  }
  return "chatgpt";
}

/**
 * Provider-specific URLs for opening a composed prompt in an external chat UI.
 */
export function getLaunchUrl(provider: LaunchProviderId, promptText: string): string {
  const encoded = encodeURIComponent(promptText);
  switch (provider) {
    case "chatgpt":
      return `https://chat.openai.com/?model=gpt-4o&prompt=${encoded}`;
    case "claude":
      return `https://claude.ai/new?q=${encoded}`;
    case "gemini":
      return `https://gemini.google.com/app?q=${encoded}`;
  }
}
