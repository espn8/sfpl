import { Router } from "express";
import { z } from "zod";
import { searchHelp } from "../services/helpSearch";
import { requireAuth, requireOnboardingComplete } from "../middleware/auth";

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
});

router.post("/search", requireAuth, requireOnboardingComplete, async (req, res) => {
  const parsed = searchQuerySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "INVALID_REQUEST",
        message: "Please provide a valid question.",
      },
    });
  }

  try {
    const result = await searchHelp(parsed.data.q);
    return res.json({ data: result });
  } catch (error) {
    console.error("Help search error:", error);
    return res.json({
      data: {
        source: "fallback" as const,
        answer:
          "Ask AI is temporarily unavailable right now. Please use the Help topic search below, or click the Slack button to get support in #help-ailibrary.",
      },
    });
  }
});

export default router;
