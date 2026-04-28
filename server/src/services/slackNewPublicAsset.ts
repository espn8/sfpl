import type { PromptModality, PromptStatus, PromptVisibility } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
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

function isPublicPublished(row: { visibility: string; status: string }): boolean {
  return row.visibility === "PUBLIC" && row.status === "PUBLISHED";
}

export function enteredPublicPublished(
  before: { visibility: string; status: string } | null,
  after: { visibility: string; status: string },
): boolean {
  if (!isPublicPublished(after)) {
    return false;
  }
  if (before === null) {
    return true;
  }
  return !isPublicPublished(before);
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

type NotifyArgs = {
  before: { visibility: PromptVisibility; status: PromptStatus } | null;
  after: {
    id: number;
    title: string;
    summary: string | null;
    visibility: PromptVisibility;
    status: PromptStatus;
    tools: string[];
    modality?: PromptModality | null;
  };
  tagNames: string[];
  assetKind: SlackAssetKind;
  ownerId: number;
};

function buildAssetLink(kind: SlackAssetKind, id: number): string {
  const base = env.appBaseUrl.replace(/\/+$/, "");
  return `${base}/${URL_SEGMENT[kind]}/${id}`;
}

/**
 * Fire-and-forget POST to Slack Workflow when an asset enters PUBLIC + PUBLISHED.
 * Does nothing if webhook URL is unset or transition does not qualify.
 */
function slackWebhookUrl(): string | undefined {
  // Read at call time so Heroku config changes take effect after dyno restart without relying on a stale snapshot.
  const fromEnv = process.env.SLACK_NEW_PUBLIC_ASSET_WEBHOOK_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return env.slackNewPublicAssetWebhookUrl;
}

export function notifySlackIfEnteredPublicPublished(args: NotifyArgs): void {
  const { before, after, tagNames, assetKind, ownerId } = args;
  if (!enteredPublicPublished(before, after)) {
    return;
  }
  const url = slackWebhookUrl();
  if (!url) {
    console.warn(
      "[slackNewPublicAsset] skip: SLACK_NEW_PUBLIC_ASSET_WEBHOOK_URL is unset but asset entered PUBLIC+PUBLISHED",
    );
    return;
  }

  // Defer past the HTTP response so Slack I/O never blocks the route; avoids edge cases with floating promises.
  setImmediate(() => {
    void (async () => {
      try {
        const owner = await prisma.user.findUnique({
          where: { id: ownerId },
          select: { email: true },
        });
        const userEmail = owner?.email ?? "";

        const payload = {
          assetname: after.title,
          assettype: ASSET_TYPE_SLACK[assetKind],
          assetlink: buildAssetLink(assetKind, after.id),
          assettags: tagNames.join(", "),
          assetsummary: after.summary?.trim() ?? "",
          user: userEmail,
          assettool: formatToolsForDisplay(after.tools),
          assetmodality: assetKind === "prompt" ? modalityLabel(after.modality ?? null) : "—",
        };

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(
            `[slackNewPublicAsset] webhook failed ${res.status} for ${assetKind} ${after.id}: ${text.slice(0, 500)}`,
          );
          return;
        }
        console.log(`[slackNewPublicAsset] posted ${assetKind} ${after.id} to Slack workflow`);
      } catch (err) {
        console.error("[slackNewPublicAsset] webhook error:", err);
      }
    })();
  });
}
