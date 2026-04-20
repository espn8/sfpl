import { env } from "./config/env";
import { createApp } from "./app";
import { startThumbnailRetryService } from "./services/thumbnailRetry";

const port = env.port;
const app = createApp();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);

  // Start background services
  startThumbnailRetryService();
});
