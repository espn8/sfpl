import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { aiRewriteRateLimit } from "../middleware/rateLimit";
import { SUMMARY_MAX_CHARS } from "../lib/summaryLimits";
import { generateSummaryRewrite } from "../services/summaryRewrite";

const aiRouter = Router();

const MAX_DRAFT_CHARS = 2000;
const MIN_DRAFT_CHARS = 3;

const summaryRewriteSchema = z.object({
  draft: z
    .string()
    .trim()
    .min(MIN_DRAFT_CHARS, "draft is too short to rewrite.")
    .max(MAX_DRAFT_CHARS, "draft is too long to rewrite."),
  title: z.string().trim().max(300).optional(),
  assetType: z.enum(["prompt", "skill", "context", "build"]),
});

aiRouter.use(requireAuth);
aiRouter.use(aiRewriteRateLimit);

aiRouter.post("/summary-rewrite", async (req: Request, res: Response) => {
  const parsed = summaryRewriteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid request.",
        details: parsed.error.issues,
      },
    });
  }

  try {
    const summary = await generateSummaryRewrite(parsed.data);
    if (summary.length > SUMMARY_MAX_CHARS) {
      return res.status(502).json({
        error: {
          code: "AI_RESPONSE_TOO_LONG",
          message: "The AI response could not be clipped under the character limit. Try again.",
        },
      });
    }
    return res.status(200).json({ summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    console.error("[AI][summary-rewrite] Failed:", message);
    return res.status(502).json({
      error: {
        code: "AI_UNAVAILABLE",
        message: "Couldn't reach the AI service right now. Please try again.",
      },
    });
  }
});

export { aiRouter };
