/** Display labels for asset `tools[]` values (shared by search, Slack webhook, etc.). */
export const TOOL_LABELS: Record<string, string> = {
  agentforce_vibes: "Agentforce Vibes",
  chatgpt: "ChatGPT",
  claude_code: "Claude Code",
  claude_cowork: "Claude Cowork",
  cursor: "Cursor",
  gemini: "Gemini",
  meshmesh: "MeshMesh",
  notebooklm: "NotebookLM",
  other: "Other",
  saleo: "Saleo",
  slackbot: "Slackbot",
};

export function formatToolsForDisplay(tools: string[]): string {
  return tools.map((t) => TOOL_LABELS[t] ?? t).join(", ");
}
