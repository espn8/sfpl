import { PromptStatus, PromptVisibility, ThumbnailStatus } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "./prisma";

const ASSET_DETAIL_PATH = /^\/(prompts|skills|context|builds)\/(\d+)\/?$/;

const KIND_LABEL: Record<string, string> = {
  prompts: "Prompt",
  skills: "Skill",
  context: "Context",
  builds: "Build",
};

export type OgInjection = {
  pageTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  ogImageUrl: string;
};

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncateForOg(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) {
    return t;
  }
  return `${t.slice(0, maxLen - 1)}…`;
}

function pickOgImage(
  thumbnailUrl: string | null | undefined,
  thumbnailStatus: ThumbnailStatus | undefined,
  fallbackAbsoluteUrl: string,
): string {
  if (
    thumbnailUrl &&
    (thumbnailUrl.startsWith("https://") || thumbnailUrl.startsWith("http://")) &&
    thumbnailStatus === ThumbnailStatus.READY
  ) {
    return thumbnailUrl;
  }
  return fallbackAbsoluteUrl;
}

function buildOg(
  title: string,
  summary: string | null,
  kindLabel: string,
  canonicalUrl: string,
  thumbnailUrl: string | null | undefined,
  thumbnailStatus: ThumbnailStatus | undefined,
  defaultImage: string,
): OgInjection {
  const summaryTrim = summary?.trim() ?? "";
  const desc =
    summaryTrim ||
    `Public ${kindLabel.toLowerCase()} in the SF AI Library — open the link to view details.`;
  return {
    pageTitle: `${title} · SF AI Library`,
    metaDescription: truncateForOg(desc, 300),
    canonicalUrl,
    ogImageUrl: pickOgImage(thumbnailUrl, thumbnailStatus, defaultImage),
  };
}

/**
 * Loads Open Graph data for link previews when the URL points at a published,
 * public asset. Crawlers do not run client JS; they only see the HTML shell,
 * so this runs on the server for GET /prompts/:id, etc.
 *
 * TEAM/PRIVATE assets return null so previews stay generic (no title leak via
 * unauthenticated fetch).
 */
export async function tryLoadPublicAssetOg(pathname: string): Promise<OgInjection | null> {
  const m = pathname.match(ASSET_DETAIL_PATH);
  if (!m) {
    return null;
  }

  const [, segment, idStr] = m;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const baseUrl = env.appBaseUrl.replace(/\/$/, "");
  const pathClean = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const canonicalUrl = `${baseUrl}${pathClean}`;
  const kindLabel = KIND_LABEL[segment] ?? "Asset";
  const defaultImage = `${baseUrl}/salesforce-logo.png`;

  const publishedPublic = {
    id,
    visibility: PromptVisibility.PUBLIC,
    status: PromptStatus.PUBLISHED,
    archivedAt: null,
  };

  if (segment === "prompts") {
    const row = await prisma.prompt.findFirst({
      where: publishedPublic,
      select: { title: true, summary: true, thumbnailUrl: true, thumbnailStatus: true },
    });
    if (!row) {
      return null;
    }
    return buildOg(row.title, row.summary, kindLabel, canonicalUrl, row.thumbnailUrl, row.thumbnailStatus, defaultImage);
  }

  if (segment === "skills") {
    const row = await prisma.skill.findFirst({
      where: publishedPublic,
      select: { title: true, summary: true, thumbnailUrl: true, thumbnailStatus: true },
    });
    if (!row) {
      return null;
    }
    return buildOg(row.title, row.summary, kindLabel, canonicalUrl, row.thumbnailUrl, row.thumbnailStatus, defaultImage);
  }

  if (segment === "context") {
    const row = await prisma.contextDocument.findFirst({
      where: publishedPublic,
      select: { title: true, summary: true, thumbnailUrl: true, thumbnailStatus: true },
    });
    if (!row) {
      return null;
    }
    return buildOg(row.title, row.summary, kindLabel, canonicalUrl, row.thumbnailUrl, row.thumbnailStatus, defaultImage);
  }

  if (segment === "builds") {
    const row = await prisma.build.findFirst({
      where: publishedPublic,
      select: { title: true, summary: true, thumbnailUrl: true, thumbnailStatus: true },
    });
    if (!row) {
      return null;
    }
    return buildOg(row.title, row.summary, kindLabel, canonicalUrl, row.thumbnailUrl, row.thumbnailStatus, defaultImage);
  }

  return null;
}

export function injectOgIntoIndexHtml(indexHtml: string, og: OgInjection): string {
  const headInject = `
    <meta name="description" content="${escapeHtmlAttr(og.metaDescription)}" />
    <link rel="canonical" href="${escapeHtmlAttr(og.canonicalUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtmlAttr("SF AI Library")}" />
    <meta property="og:title" content="${escapeHtmlAttr(og.pageTitle)}" />
    <meta property="og:description" content="${escapeHtmlAttr(og.metaDescription)}" />
    <meta property="og:url" content="${escapeHtmlAttr(og.canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtmlAttr(og.ogImageUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtmlAttr(og.pageTitle)}" />
    <meta name="twitter:description" content="${escapeHtmlAttr(og.metaDescription)}" />
    <meta name="twitter:image" content="${escapeHtmlAttr(og.ogImageUrl)}" />
`.trim();

  let out = indexHtml.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtmlAttr(og.pageTitle)}</title>`);
  out = out.replace("</head>", `    ${headInject}\n  </head>`);
  return out;
}
