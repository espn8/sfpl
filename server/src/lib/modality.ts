import { PromptModality } from "@prisma/client";
import { z } from "zod";

export const API_MODALITIES = ["text", "code", "image", "video", "audio", "multimodal"] as const;
export type ApiModality = (typeof API_MODALITIES)[number];

export const apiModalitySchema = z.enum(API_MODALITIES);

export const apiToDbModality: Record<ApiModality, PromptModality> = {
  text: PromptModality.TEXT,
  code: PromptModality.CODE,
  image: PromptModality.IMAGE,
  video: PromptModality.VIDEO,
  audio: PromptModality.AUDIO,
  multimodal: PromptModality.MULTIMODAL,
};

export function mapLegacyModalityToDb(value?: string | null): PromptModality {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "code") {
    return PromptModality.CODE;
  }
  if (normalized === "image") {
    return PromptModality.IMAGE;
  }
  if (normalized === "video") {
    return PromptModality.VIDEO;
  }
  if (normalized === "audio") {
    return PromptModality.AUDIO;
  }
  if (normalized === "multimodal" || normalized === "multi-modal" || normalized === "multi modal") {
    return PromptModality.MULTIMODAL;
  }
  return PromptModality.TEXT;
}

export function mapDbModalityToApi(value: PromptModality): ApiModality {
  switch (value) {
    case PromptModality.CODE:
      return "code";
    case PromptModality.IMAGE:
      return "image";
    case PromptModality.VIDEO:
      return "video";
    case PromptModality.AUDIO:
      return "audio";
    case PromptModality.MULTIMODAL:
      return "multimodal";
    case PromptModality.TEXT:
    default:
      return "text";
  }
}
