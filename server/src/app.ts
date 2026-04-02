import connectPgSimple from "connect-pg-simple";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import session from "express-session";
import type { Store } from "express-session";
import path from "path";
import pg from "pg";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { errorHandler } from "./middleware/errorHandler";
import { analyticsRouter } from "./routes/analytics";
import { authRouter } from "./routes/auth";
import { collectionsRouter } from "./routes/collections";
import { promptsRouter } from "./routes/prompts";
import { tagsRouter } from "./routes/tags";

type CreateAppOptions = {
  sessionStore?: Store;
};

export function createApp(options?: CreateAppOptions): express.Express {
  const app = express();
  const PgStore = connectPgSimple(session);
  const sessionStore =
    options?.sessionStore ??
    new PgStore({
      pool: new pg.Pool({
        connectionString: env.databaseUrl,
        ssl: env.nodeEnv === "production" ? { rejectUnauthorized: false } : false,
        max: 5,
        min: 1,
        idleTimeoutMillis: 60000,
        connectionTimeoutMillis: 30000,
      }),
      tableName: "session",
      createTableIfMissing: true,
    });

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(
    session({
      store: sessionStore,
      name: "promptlibrary.sid",
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: env.cookieSecure,
        sameSite: env.sessionSameSite,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );
  app.use(express.json());

  app.get("/favicon.ico", (_req, res) => {
    res.redirect(
      302,
      "https://a.sfdcstatic.com/shared/images/c360-nav/salesforce-with-type-logo.svg",
    );
  });

  app.get("/api/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true });
    } catch (_error) {
      res.status(500).json({ ok: false });
    }
  });

  app.use("/api/auth", authRouter);
  app.use("/api/prompts", promptsRouter);
  app.use("/api/collections", collectionsRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/tags", tagsRouter);

  const publicPath = path.resolve(__dirname, "../public");
  app.use(express.static(publicPath));

  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });

  app.use(errorHandler);

  return app;
}
