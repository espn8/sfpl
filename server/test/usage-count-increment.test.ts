import session from "express-session";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Phase 3: every time a usage event is logged for COPY (or LAUNCH, on prompts),
// the denormalized usageCount column on the owning asset row must be
// incremented in the SAME transaction as the event insert. This test guards
// against the counters drifting and silently desyncing sort=mostUsed ordering.

const transactionCalls: unknown[][] = [];
const createEventCalls = {
  usageEvent: vi.fn(),
  skillUsageEvent: vi.fn(),
  contextUsageEvent: vi.fn(),
  buildUsageEvent: vi.fn(),
};
const updateCalls = {
  prompt: vi.fn(),
  skill: vi.fn(),
  contextDocument: vi.fn(),
  build: vi.fn(),
};

function buildPrismaMock() {
  return {
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (ops: unknown[]) => {
      transactionCalls.push(ops);
      return ops.map(() => ({}));
    }),
    usageEvent: {
      create: (args: unknown) => {
        createEventCalls.usageEvent(args);
        return Promise.resolve({});
      },
    },
    skillUsageEvent: {
      create: (args: unknown) => {
        createEventCalls.skillUsageEvent(args);
        return Promise.resolve({});
      },
    },
    contextUsageEvent: {
      create: (args: unknown) => {
        createEventCalls.contextUsageEvent(args);
        return Promise.resolve({});
      },
    },
    buildUsageEvent: {
      create: (args: unknown) => {
        createEventCalls.buildUsageEvent(args);
        return Promise.resolve({});
      },
    },
    prompt: {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        teamId: 1,
        ownerId: 1,
        visibility: "TEAM",
        owner: { ou: null },
      }),
      update: (args: unknown) => {
        updateCalls.prompt(args);
        return Promise.resolve({});
      },
    },
    skill: {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        teamId: 1,
        ownerId: 1,
        visibility: "TEAM",
        owner: { ou: null },
      }),
      update: (args: unknown) => {
        updateCalls.skill(args);
        return Promise.resolve({});
      },
    },
    contextDocument: {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        teamId: 1,
        ownerId: 1,
        visibility: "TEAM",
        owner: { ou: null },
      }),
      update: (args: unknown) => {
        updateCalls.contextDocument(args);
        return Promise.resolve({});
      },
    },
    build: {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        teamId: 1,
        ownerId: 1,
        visibility: "TEAM",
        owner: { ou: null },
      }),
      update: (args: unknown) => {
        updateCalls.build(args);
        return Promise.resolve({});
      },
    },
  };
}

const prismaMock = buildPrismaMock();

vi.mock("../src/middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOnboardingComplete: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireWriteAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuthContext: () => ({ userId: 1, teamId: 1, role: "MEMBER", userOu: null }),
}));

vi.mock("../src/lib/visibility", () => ({
  buildVisibilityWhereFragment: () => ({ OR: [{ teamId: 1 }] }),
  canAccessByVisibility: () => true,
  canAccessPromptByVisibility: () => true,
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("usage-logging endpoints increment denormalized usageCount (Phase 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionCalls.length = 0;
  });

  it("POST /api/prompts/:id/usage with COPY increments prompt.usageCount inside a $transaction", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app)
      .post("/api/prompts/1/usage")
      .send({ action: "COPY" })
      .set("content-type", "application/json");
    expect(response.status).toBe(200);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(updateCalls.prompt).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { usageCount: { increment: 1 } },
    });
  });

  it("POST /api/prompts/:id/usage with LAUNCH also increments prompt.usageCount", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app)
      .post("/api/prompts/1/usage")
      .send({ action: "LAUNCH" })
      .set("content-type", "application/json");
    expect(response.status).toBe(200);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(updateCalls.prompt).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { usageCount: { increment: 1 } },
    });
  });

  it("POST /api/prompts/:id/usage with VIEW does NOT increment (views aren't 'usage')", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app)
      .post("/api/prompts/1/usage")
      .send({ action: "VIEW" })
      .set("content-type", "application/json");
    expect(response.status).toBe(200);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(updateCalls.prompt).not.toHaveBeenCalled();
    expect(createEventCalls.usageEvent).toHaveBeenCalledTimes(1);
  });

  it("POST /api/skills/:id/usage with COPY increments skill.usageCount inside a $transaction", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app)
      .post("/api/skills/1/usage")
      .send({ eventType: "COPY" })
      .set("content-type", "application/json");
    expect(response.status).toBe(200);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(updateCalls.skill).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { usageCount: { increment: 1 } },
    });
  });

  it("POST /api/skills/:id/usage with VIEW does NOT increment usageCount", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app)
      .post("/api/skills/1/usage")
      .send({ eventType: "VIEW" })
      .set("content-type", "application/json");
    expect(response.status).toBe(200);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(updateCalls.skill).not.toHaveBeenCalled();
    expect(createEventCalls.skillUsageEvent).toHaveBeenCalledTimes(1);
  });

  it("POST /api/context/:id/usage with COPY increments contextDocument.usageCount", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app)
      .post("/api/context/1/usage")
      .send({ eventType: "COPY" })
      .set("content-type", "application/json");
    expect(response.status).toBe(200);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(updateCalls.contextDocument).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { usageCount: { increment: 1 } },
    });
  });

  it("POST /api/builds/:id/usage with COPY increments build.usageCount", async () => {
    const { createApp } = await import("../src/app");
    const app = createApp({ sessionStore: new session.MemoryStore() });

    const response = await request(app)
      .post("/api/builds/1/usage")
      .send({ eventType: "COPY" })
      .set("content-type", "application/json");
    expect(response.status).toBe(200);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(updateCalls.build).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { usageCount: { increment: 1 } },
    });
  });
});
