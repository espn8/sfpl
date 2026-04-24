import { env } from "./config/env";
import { createApp } from "./app";
import { startThumbnailRetryService } from "./services/thumbnailRetry";
import { ensureSystemCollectionsForAllTeams } from "./services/systemCollections";

const port = env.port;
const app = createApp();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);

  startThumbnailRetryService();

  ensureSystemCollectionsForAllTeams()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("[systemCollections] Ensured default system collections for all teams");
    })
    .catch((error) => {
      console.error("[systemCollections] Failed during startup ensure:", error);
    });
});
