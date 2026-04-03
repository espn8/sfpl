import express from "express";
import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUserFindUnique = vi.fn();

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

async function buildAuthTestApp() {
  const { authRouter } = await import("../src/routes/auth");
  const app = express();
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
      store: new session.MemoryStore(),
    }),
  );

  app.post("/test/login", (req, res) => {
    req.session.auth = { userId: 1, teamId: 1, role: "MEMBER" };
    req.session.save(() => res.status(200).json({ ok: true }));
  });
  app.post("/test/login-malformed", (req, res) => {
    req.session.auth = { userId: Number.NaN, teamId: 1, role: "MEMBER" };
    req.session.save(() => res.status(200).json({ ok: true }));
  });

  app.use("/api/auth", authRouter);
  return app;
}

describe("auth session endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for /me when unauthenticated", async () => {
    const app = await buildAuthTestApp();
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns current user for /me when authenticated", async () => {
    const app = await buildAuthTestApp();
    const agent = request.agent(app);
    mockUserFindUnique.mockResolvedValue({
      id: 1,
      email: "user@example.com",
      name: "User",
      role: "MEMBER",
      teamId: 1,
    });

    await agent.post("/test/login").expect(200);
    const response = await agent.get("/api/auth/me");

    expect(response.status).toBe(200);
    expect(response.body.data.email).toBe("user@example.com");
  });

  it("returns 401 for /me when session payload is malformed", async () => {
    const app = await buildAuthTestApp();
    const agent = request.agent(app);
    await agent.post("/test/login-malformed").expect(200);

    const response = await agent.get("/api/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it("clears session on logout", async () => {
    const app = await buildAuthTestApp();
    const agent = request.agent(app);
    await agent.post("/test/login").expect(200);

    await agent.post("/api/auth/logout").expect(200);
    const meAfterLogout = await agent.get("/api/auth/me");

    expect(meAfterLogout.status).toBe(401);
    expect(meAfterLogout.body.error.code).toBe("UNAUTHORIZED");
  });
});
