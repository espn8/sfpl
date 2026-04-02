import session from "express-session";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

describe("auth rate limit", () => {
  it("returns 429 after configured auth request limit", async () => {
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = "60000";
    process.env.AUTH_RATE_LIMIT_MAX = "2";
    vi.resetModules();

    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const first = await request(app).get("/api/auth/google/start");
    const second = await request(app).get("/api/auth/google/start");
    const third = await request(app).get("/api/auth/google/start");

    expect(first.status).toBe(302);
    expect(second.status).toBe(302);
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe("TOO_MANY_REQUESTS");
  });
});
