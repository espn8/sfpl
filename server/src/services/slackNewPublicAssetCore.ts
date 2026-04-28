import type { PrismaClient, PromptModality } from "@prisma/client";
import { formatToolsForDisplay } from "../lib/toolLabels";

export type SlackAssetKind = "prompt" | "skill" | "context" | "build";

const ASSET_TYPE_SLACK: Record<SlackAssetKind, string> = {
  prompt: "Prompt",
  skill: "Skill",
  context: "Context",
  build: "Build",
};

const URL_SEGMENT: Record<SlackAssetKind, string> = {
  prompt: "prompts",
  skill: "skills",
  context: "context",
  build: "builds",
};

/** Relative web path for an asset detail page (no leading slash). */
export function slackAssetWebPath(kind: SlackAssetKind, id: number): string {
  return `${URL_SEGMENT[kind]}/${id}`;
}

function buildAssetLink(appBaseUrl: string, kind: SlackAssetKind, id: number): string {
  const base = appBaseUrl.replace(/\/+$/, "");
  return `${base}/${URL_SEGMENT[kind]}/${id}`;
}

function modalityLabel(modality: PromptModality | null | undefined): string {
  if (modality === undefined || modality === null) {
    return "";
  }
  switch (modality) {
    case "TEXT":
      return "text";
    case "CODE":
      return "code";
    case "IMAGE":
      return "image";
    case "VIDEO":
      return "video";
    case "AUDIO":
      return "audio";
    case "MULTIMODAL":
      return "multimodal";
    default:
      return String(modality).toLowerCase();
  }
}

export type SendSlackPublicPublishedAssetParams = {
  webhookUrl: string;
  appBaseUrl: string;
  assetKind: SlackAssetKind;
  id: number;
  title: string;
  summary: string | null;
  tools: string[];
  modality?: PromptModality | null;
  tagNames: string[];
  ownerId: number;
};

/**
 * POST one asset to a Slack Workflow webhook (flat JSON body).
 * Does not read `config/env`; callers pass URLs explicitly (safe for one-off scripts).
 */
export async function sendSlackPublicPublishedAsset(
  prisma: PrismaClient,
  params: SendSlackPublicPublishedAssetParams,
): Promise<void> {
  const { webhookUrl, appBaseUrl, assetKind, id, title, summary, tools, modality, tagNames, ownerId } = params;

  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { email: true },
  });
  const userEmail = owner?.email ?? "";

  const payload = {
    assetname: title,
    assettype: ASSET_TYPE_SLACK[assetKind],
    assetlink: buildAssetLink(appBaseUrl, assetKind, id),
    assettags: tagNames.join(", "),
    assetsummary: summary?.trim() ?? "",
    user: userEmail,
    assettool: formatToolsForDisplay(tools),
    assetmodality: assetKind === "prompt" ? modalityLabel(modality ?? null) : "—",
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      `[slackNewPublicAsset] webhook failed ${res.status} for ${assetKind} ${id}: ${text.slice(0, 500)}`,
    );
    return;
  }
  console.log(`[slackNewPublicAsset] posted ${assetKind} ${id} to Slack workflow`);
}
