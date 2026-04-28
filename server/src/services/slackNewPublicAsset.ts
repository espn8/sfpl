import type { PromptModality, PromptStatus, PromptVisibility } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { sendSlackPublicPublishedAsset, type SlackAssetKind } from "./slackNewPublicAssetCore";

export type { SlackAssetKind } from "./slackNewPublicAssetCore";

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

function slackWebhookUrl(): string | undefined {
  const fromEnv = process.env.SLACK_NEW_PUBLIC_ASSET_WEBHOOK_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return env.slackNewPublicAssetWebhookUrl;
}

/**
 * Fire-and-forget POST to Slack Workflow when an asset enters PUBLIC + PUBLISHED.
 * Does nothing if webhook URL is unset or transition does not qualify.
 */
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

  const appBaseUrl = process.env.APP_BASE_URL?.trim() || env.appBaseUrl;

  setImmediate(() => {
    void (async () => {
      try {
        await sendSlackPublicPublishedAsset(prisma, {
          webhookUrl: url,
          appBaseUrl,
          assetKind,
          id: after.id,
          title: after.title,
          summary: after.summary,
          tools: after.tools,
          modality: after.modality,
          tagNames,
          ownerId,
        });
      } catch (err) {
        console.error("[slackNewPublicAsset] webhook error:", err);
      }
    })();
  });
}
