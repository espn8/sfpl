import express from "express";
import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPrismaMock } from "./helpers/mockPrisma";

const prismaMock = buildPrismaMock({
  user: {
    groupBy: vi.fn(),
    findUnique: vi.fn().mockResolvedValue({
      role: "ADMIN",
      teamId: 42,
      ou: "Engineering",
      onboardingCompleted: true,
    }),
  },
});

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

const userModel = prismaMock.user as Record<string, ReturnType<typeof vi.fn>>;

async function makeApp() {
  const { adminRouter } = await import("../src/routes/admin");
  const app = express();
  app.use(express.json());
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
      teamId: 42,
      role: "ADMIN",
      userOu: "Engineering",
      onboardingCompleted: true,
    };
    next();
  });
  app.use("/api/admin", adminRouter);
  return app;
}

describe("GET /api/admin/department-ous/custom-in-use", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only non-canonical User.ou values sorted by user count", async () => {
    userModel.groupBy.mockResolvedValue([
      { ou: "Engineering", _count: { _all: 5 } },
      { ou: "ANZ - Sales", _count: { _all: 2 } },
      { ou: "Custom Labs", _count: { _all: 3 } },
    ]);
    const app = await makeApp();
    const res = await request(app).get("/api/admin/department-ous/custom-in-use");
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toEqual([
      { ou: "Custom Labs", userCount: 3 },
      { ou: "ANZ - Sales", userCount: 2 },
    ]);
    expect(userModel.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamId: 42, ou: { not: null } },
      }),
    );
  });
});
