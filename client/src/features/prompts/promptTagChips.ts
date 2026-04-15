import { getToolLabel, type PromptTool } from "./api";

export function toolChipFromPrompt(tools: PromptTool[], modelHint: string | null | undefined): string | null {
  if (tools[0]) {
    return getToolLabel(tools[0]);
  }
  const hint = modelHint?.trim();
  return hint && hint.length > 0 ? hint : null;
}

export function modalityLabel(modality: string): string {
  return modality.length > 0 ? modality.charAt(0).toUpperCase() + modality.slice(1) : modality;
}

export function buildPromptTagChips(input: {
  tools: PromptTool[];
  modality: string;
  modelHint?: string | null;
  tagNames: string[];
}): string[] {
  const toolChip = toolChipFromPrompt(input.tools, input.modelHint);
  return [
    ...(toolChip ? [toolChip] : []),
    modalityLabel(input.modality),
    ...input.tagNames.filter((t) => t.trim().length > 0),
  ].slice(0, 8);
}

export function promptOwnerAvatarUrl(owner: { id: number; avatarUrl: string | null }): string {
  if (owner.avatarUrl?.trim()) {
    return owner.avatarUrl.trim();
  }
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(String(owner.id))}`;
}
