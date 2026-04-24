import express from "express";
import session from "express-session";
import request from "supertest";
import { describe, expect, it } from "vitest";

describe("profile onboarding gate", () => {
  it("returns 403 PROFILE_SETUP_REQUIRED when session has onboardingCompleted false", async () => {
    const { promptsRouter } = await import("../src/routes/prompts");
    const app = express();
    app.use(
      session({
        secret: "test-secret",
        resave: false,
        saveUninitialized: true,
        store: new session.MemoryStore(),
      }),
    );
    app.use((req, _res, next) => {
      req.session.auth = {
        userId: 1,
        teamId: 1,
        role: "MEMBER",
        userOu: null,
        onboardingCompleted: false,
      };
      next();
    });
    app.use("/api/prompts", promptsRouter);

    const response = await request(app).get("/api/prompts");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PROFILE_SETUP_REQUIRED");
  });
});
