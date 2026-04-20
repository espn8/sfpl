import { prisma } from "../lib/prisma";
import { generatePromptThumbnail } from "./nanoBanana";

const RETRY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STUCK_THRESHOLD_MS = 2 * 60 * 1000; // Consider PENDING stuck after 2 minutes

async function retryStuckPrompts() {
  const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MS);

  const stuckPrompts = await prisma.prompt.findMany({
    where: {
      thumbnailStatus: "PENDING",
      updatedAt: { lt: stuckThreshold },
    },
    select: { id: true, title: true, summary: true, body: true },
    take: 10,
  });

  for (const prompt of stuckPrompts) {
    console.log(`[ThumbnailRetry] Retrying stuck prompt ${prompt.id}: "${prompt.title}"`);
    try {
      const thumbnailUrl = await generatePromptThumbnail({
        title: prompt.title,
        summary: prompt.summary,
        body: prompt.body,
      });
      await prisma.prompt.update({
        where: { id: prompt.id },
        data: { thumbnailUrl, thumbnailStatus: "READY", thumbnailError: null },
      });
      console.log(`[ThumbnailRetry] Successfully generated thumbnail for prompt ${prompt.id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message.slice(0, 400) : "Unknown error";
      console.error(`[ThumbnailRetry] Failed prompt ${prompt.id}:`, message);
      await prisma.prompt.update({
        where: { id: prompt.id },
        data: { thumbnailStatus: "FAILED", thumbnailError: message },
      });
    }
  }

  return stuckPrompts.length;
}

async function retryStuckSkills() {
  const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MS);

  const stuckSkills = await prisma.skill.findMany({
    where: {
      thumbnailStatus: "PENDING",
      updatedAt: { lt: stuckThreshold },
    },
    select: { id: true, title: true, summary: true, body: true },
    take: 10,
  });

  for (const skill of stuckSkills) {
    console.log(`[ThumbnailRetry] Retrying stuck skill ${skill.id}: "${skill.title}"`);
    try {
      const thumbnailUrl = await generatePromptThumbnail({
        title: skill.title,
        summary: skill.summary,
        body: skill.body,
      });
      await prisma.skill.update({
        where: { id: skill.id },
        data: { thumbnailUrl, thumbnailStatus: "READY", thumbnailError: null },
      });
      console.log(`[ThumbnailRetry] Successfully generated thumbnail for skill ${skill.id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message.slice(0, 400) : "Unknown error";
      console.error(`[ThumbnailRetry] Failed skill ${skill.id}:`, message);
      await prisma.skill.update({
        where: { id: skill.id },
        data: { thumbnailStatus: "FAILED", thumbnailError: message },
      });
    }
  }

  return stuckSkills.length;
}

async function retryStuckContextDocs() {
  const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MS);

  const stuckDocs = await prisma.contextDocument.findMany({
    where: {
      thumbnailStatus: "PENDING",
      updatedAt: { lt: stuckThreshold },
    },
    select: { id: true, title: true, summary: true, body: true },
    take: 10,
  });

  for (const doc of stuckDocs) {
    console.log(`[ThumbnailRetry] Retrying stuck context doc ${doc.id}: "${doc.title}"`);
    try {
      const thumbnailUrl = await generatePromptThumbnail({
        title: doc.title,
        summary: doc.summary,
        body: doc.body,
      });
      await prisma.contextDocument.update({
        where: { id: doc.id },
        data: { thumbnailUrl, thumbnailStatus: "READY", thumbnailError: null },
      });
      console.log(`[ThumbnailRetry] Successfully generated thumbnail for context doc ${doc.id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message.slice(0, 400) : "Unknown error";
      console.error(`[ThumbnailRetry] Failed context doc ${doc.id}:`, message);
      await prisma.contextDocument.update({
        where: { id: doc.id },
        data: { thumbnailStatus: "FAILED", thumbnailError: message },
      });
    }
  }

  return stuckDocs.length;
}

async function runRetryPass() {
  try {
    const promptCount = await retryStuckPrompts();
    const skillCount = await retryStuckSkills();
    const contextCount = await retryStuckContextDocs();

    const total = promptCount + skillCount + contextCount;
    if (total > 0) {
      console.log(`[ThumbnailRetry] Processed ${total} stuck items (${promptCount} prompts, ${skillCount} skills, ${contextCount} context docs)`);
    }
  } catch (error) {
    console.error("[ThumbnailRetry] Error during retry pass:", error);
  }
}

let retryInterval: ReturnType<typeof setInterval> | null = null;

export function startThumbnailRetryService() {
  if (retryInterval) {
    return;
  }

  console.log("[ThumbnailRetry] Starting thumbnail retry service");

  // Run immediately on startup to catch any items stuck from before
  void runRetryPass();

  // Then run periodically
  retryInterval = setInterval(() => {
    void runRetryPass();
  }, RETRY_INTERVAL_MS);
}

export function stopThumbnailRetryService() {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
    console.log("[ThumbnailRetry] Stopped thumbnail retry service");
  }
}
