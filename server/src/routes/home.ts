import type { Request, Response } from "express";
import { Router } from "express";
import { getAuthContext, requireAuth, requireOnboardingComplete } from "../middleware/auth";
import { getGlobalContributorsThisWeek } from "../services/globalContributorsThisWeek";
import { getGlobalMostActiveThisWeek } from "../services/globalMostActiveThisWeek";

const homeRouter = Router();
homeRouter.use(requireAuth);
homeRouter.use(requireOnboardingComplete);

homeRouter.get("/leaderboards", async (req: Request, res: Response) => {
  const auth = getAuthContext(req);
  if (!auth) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  }

  const [contributors, mostActive] = await Promise.all([getGlobalContributorsThisWeek(10), getGlobalMostActiveThisWeek(10)]);

  return res.status(200).json({
    data: {
      contributors,
      mostActive,
    },
  });
});

export { homeRouter };
