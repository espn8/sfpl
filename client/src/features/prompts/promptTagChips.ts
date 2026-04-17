import { getToolLabel, type PromptTool } from "./api";

export function toolChipsFromPrompt(tools: PromptTool[], modelHint: string | null | undefined): string[] {
  if (tools.length > 0) {
    return tools.map((tool) => getToolLabel(tool));
  }
  const hint = modelHint?.trim();
  return hint && hint.length > 0 ? [hint] : [];
}

export function modalityLabel(modality: string): string {
  return modality.length > 0 ? modality.charAt(0).toUpperCase() + modality.slice(1) : modality;
}

export function buildPromptTagChips(input: {
  tools: PromptTool[];
  modality: string;
  modelHint?: string | null;
}): string[] {
  const toolChips = toolChipsFromPrompt(input.tools, input.modelHint);
  return [
    ...toolChips,
    modalityLabel(input.modality),
  ].slice(0, 8);
}

export function promptOwnerAvatarUrl(owner: { id: number; avatarUrl: string | null }): string {
  if (owner.avatarUrl?.trim()) {
    return owner.avatarUrl.trim();
  }
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(String(owner.id))}`;
}
