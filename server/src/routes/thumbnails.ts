import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import { getAuthContext, requireAuth, requireOnboardingComplete } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { canAccessByVisibility } from "../lib/visibility";

const thumbnailsRouter = Router();

thumbnailsRouter.use(requireAuth);
thumbnailsRouter.use(requireOnboardingComplete);

const ASSET_TYPES = ["prompt", "context", "build", "skill"] as const;
type AssetType = (typeof ASSET_TYPES)[number];

function isAssetType(value: string): value is AssetType {
  return (ASSET_TYPES as readonly string[]).includes(value);
}

type ThumbnailRow = {
  teamId: number;
  ownerId: number;
  visibility: string;
  thumbnailUrl: string | null;
  owner: { ou: string | null } | null;
};

async function loadRow(assetType: AssetType, id: number): Promise<ThumbnailRow | null> {
  const select = {
    teamId: true,
    ownerId: true,
    visibility: true,
    thumbnailUrl: true,
    owner: { select: { ou: true } },
  } as const;

  if (assetType === "prompt") {
    return prisma.prompt.findUnique({ where: { id }, select });
  }
  if (assetType === "context") {
    return prisma.contextDocument.findUnique({ where: { id }, select });
  }
  if (assetType === "build") {
    return prisma.build.findUnique({ where: { id }, select });
  }
  // skill: no `visibility` field on skills today, but the select still works
  // if the schema has ownerId/teamId. Skills currently store `skillUrl` not a
  // base64 thumbnail, so this branch exists mainly for forward-compat.
  return prisma.skill.findUnique({
    where: { id },
    select: {
      teamId: true,
      ownerId: true,
      visibility: true,
      thumbnailUrl: true,
      owner: { select: { ou: true } },
    },
  });
}

type DataUrlParts = { mimeType: string; body: Buffer };

export function parseDataUrl(dataUrl: string): DataUrlParts | null {
  const match = /^data:([^;,]+)(;base64)?,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  const mimeType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const data = match[3] ?? "";
  try {
    const body = isBase64
      ? Buffer.from(data, "base64")
      : Buffer.from(decodeURIComponent(data), "utf8");
    return { mimeType, body };
  } catch {
    return null;
  }
}

thumbnailsRouter.get("/:assetType/:id", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rawAssetType = Array.isArray(req.params.assetType)
    ? req.params.assetType[0]
    : req.params.assetType;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (typeof rawAssetType !== "string" || !isAssetType(rawAssetType)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const assetType = rawAssetType;

  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const row = await loadRow(assetType, id);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (
    !canAccessByVisibility(
      {
        teamId: row.teamId,
        ownerId: row.ownerId,
        visibility: row.visibility,
        owner: row.owner,
      },
      auth,
    )
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const stored = row.thumbnailUrl;
  if (!stored) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (!stored.startsWith("data:")) {
    res.redirect(302, stored);
    return;
  }

  const parts = parseDataUrl(stored);
  if (!parts) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const etag = `"${createHash("sha1").update(stored).digest("hex").slice(0, 16)}"`;
  if (req.headers["if-none-match"] === etag) {
    res.status(304).end();
    return;
  }

  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", "private, max-age=3600, must-revalidate");
  res.setHeader("Content-Type", parts.mimeType);
  res.setHeader("Content-Length", String(parts.body.length));
  res.status(200).end(parts.body);
});

/**
 * Returns the reference URL to send in list responses for this asset's
 * thumbnail, without requiring the full (potentially 2 MB base64) thumbnail
 * value to be selected from the database.
 *
 * Callers should pass a small, cheap-to-select signal:
 *   - `thumbnailStatus`: the row's ThumbnailStatus; a thumbnail is only
 *     guaranteed to exist on the row when status is `"READY"`.
 *   - `updatedAt`: used as a cache-buster so the browser refetches when the
 *     row is edited (which, in practice, correlates with thumbnail changes).
 *
 * When the status is not READY, returns `null` so the client renders its
 * gradient placeholder instead of issuing a request that would 404.
 */
export function thumbnailRefFor(
  assetType: AssetType,
  id: number,
  thumbnailStatus: string | null | undefined,
  updatedAt: Date | string | null | undefined,
): string | null {
  if (thumbnailStatus !== "READY") return null;
  const ts =
    updatedAt instanceof Date
      ? updatedAt.getTime()
      : typeof updatedAt === "string"
        ? Date.parse(updatedAt) || 0
        : 0;
  return `/api/thumbnails/${assetType}/${id}?v=${ts.toString(36)}`;
}

export { thumbnailsRouter };
