import session from "express-session";
import request from "supertest";
import { describe, expect, it } from "vitest";

describe("SPA fallback vs static assets", () => {
  it("returns 404 for missing /assets chunks instead of index.html", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/assets/PromptEditPage-stalehash.js");

    expect(response.status).toBe(404);
    expect(response.text).toBe("Not found");
    expect(response.type).toMatch(/plain/);
  });

  it("returns 404 for other missing static extensions instead of HTML shell", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app).get("/some-name.css");

    expect(response.status).toBe(404);
    expect(response.text).toBe("Not found");
  });
});
