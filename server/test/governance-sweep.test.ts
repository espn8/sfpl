import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPrismaMock } from "./helpers/mockPrisma";

const prismaMock = buildPrismaMock();

vi.mock("../src/lib/prisma", () => ({ prisma: prismaMock }));

const sendBrandedEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("../src/lib/email", () => ({
  sendBrandedEmail: (...args: unknown[]) => sendBrandedEmail(...args),
  escapeHtml: (s: string) => s,
}));

const envMock = {
  appBaseUrl: "https://example.test",
  governanceSweepEnabled: true,
};
vi.mock("../src/config/env", () => ({
  get env() {
    return envMock;
  },
}));

type FindManyMock = ReturnType<typeof vi.fn>;

async function load() {
  return await import("../src/jobs/governance");
}

function promptModel() {
  return prismaMock.prompt as Record<string, ReturnType<typeof vi.fn>>;
}
function skillModel() {
  return prismaMock.skill as Record<string, ReturnType<typeof vi.fn>>;
}
function contextModel() {
  return prismaMock.contextDocument as Record<string, ReturnType<typeof vi.fn>>;
}
function buildModel() {
  return prismaMock.build as Record<string, ReturnType<typeof vi.fn>>;
}
function verificationModel() {
  return prismaMock.assetVerification as Record<string, ReturnType<typeof vi.fn>>;
}
function ratingModel(name: "rating" | "skillRating" | "contextRating" | "buildRating") {
  return prismaMock[name] as Record<string, ReturnType<typeof vi.fn>>;
}

function wireEmptySweep(findMany: FindManyMock) {
  // warn, overdue, inactive, lowRated — all empty.
  findMany
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
}

function wireSmartPicksEmpty(model: ReturnType<typeof promptModel>) {
  // computeTopScored uses `findMany({ status: PUBLISHED, OR:[...] })` (eligible)
  // then listCurrentSmartPicks uses `findMany({ isSmartPick: true })`.
  model.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
}

describe("runGovernanceSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendBrandedEmail.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns zero counts when no assets match any sweep condition", async () => {
    for (const m of [promptModel(), skillModel(), contextModel(), buildModel()]) {
      wireEmptySweep(m.findMany as FindManyMock);
    }
    const { runGovernanceSweep } = await load();
    const result = await runGovernanceSweep({ now: new Date("2026-05-01T00:00:00Z") });
    expect(result.totals).toEqual({
      warningsSent: 0,
      archivedUnverified: 0,
      archivedInactive: 0,
      archivedLowRating: 0,
    });
    expect(result.smartPicksRecomputed).toBe(0);
    expect(sendBrandedEmail).not.toHaveBeenCalled();
  });

  it("warns once per due asset, archives overdue assets, and writes audit rows", async () => {
    const dueSoon = {
      id: 101,
      title: "Due soon prompt",
      verificationDueAt: new Date("2026-05-05T00:00:00Z"),
      updatedAt: new Date("2026-04-01T00:00:00Z"),
      owner: { id: 9, email: "owner@test", name: "Owner" },
    };
    const overdue = {
      id: 102,
      title: "Overdue prompt",
      verificationDueAt: new Date("2026-04-01T00:00:00Z"),
      updatedAt: new Date("2026-03-01T00:00:00Z"),
      owner: { id: 9, email: "owner@test", name: "Owner" },
    };

    const p = promptModel();
    (p.findMany as FindManyMock)
      .mockResolvedValueOnce([dueSoon])
      .mockResolvedValueOnce([overdue])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    for (const m of [skillModel(), contextModel(), buildModel()]) {
      wireEmptySweep(m.findMany as FindManyMock);
    }

    const { runGovernanceSweep } = await load();
    const result = await runGovernanceSweep({ now: new Date("2026-05-01T00:00:00Z") });

    expect(result.totals.warningsSent).toBe(1);
    expect(result.totals.archivedUnverified).toBe(1);
    expect(result.totals.archivedInactive).toBe(0);
    expect(result.totals.archivedLowRating).toBe(0);

    expect(sendBrandedEmail).toHaveBeenCalledTimes(2);

    expect(p.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: dueSoon.id },
        data: expect.objectContaining({ warningSentAt: expect.any(Date) }),
      }),
    );
    expect(p.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: overdue.id },
        data: expect.objectContaining({ status: "ARCHIVED", archiveReason: "UNVERIFIED" }),
      }),
    );

    expect(verificationModel().create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assetType: "PROMPT",
          assetId: overdue.id,
          action: "ARCHIVED",
          reason: "UNVERIFIED",
        }),
      }),
    );
  });

  it("dry-run does not mutate data or send email", async () => {
    const dueSoon = {
      id: 5,
      title: "Prompt",
      verificationDueAt: new Date("2026-05-04T00:00:00Z"),
      updatedAt: new Date("2026-04-01T00:00:00Z"),
      owner: { id: 1, email: "x@y", name: "X" },
    };
    const p = promptModel();
    (p.findMany as FindManyMock)
      .mockResolvedValueOnce([dueSoon])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    wireSmartPicksEmpty(p);
    for (const m of [skillModel(), contextModel(), buildModel()]) {
      wireEmptySweep(m.findMany as FindManyMock);
      wireSmartPicksEmpty(m);
    }

    const { runGovernanceSweep } = await load();
    const result = await runGovernanceSweep({
      now: new Date("2026-05-01T00:00:00Z"),
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.totals.warningsSent).toBe(1);
    expect(sendBrandedEmail).not.toHaveBeenCalled();
    expect(p.update).not.toHaveBeenCalled();
    expect(verificationModel().create).not.toHaveBeenCalled();
  });
});

describe("runGovernanceSweepWithGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendBrandedEmail.mockClear();
    envMock.governanceSweepEnabled = true;
  });

  it("forces dry-run when GOVERNANCE_SWEEP_ENABLED is false", async () => {
    envMock.governanceSweepEnabled = false;
    const dueSoon = {
      id: 42,
      title: "P",
      verificationDueAt: new Date("2026-05-05T00:00:00Z"),
      updatedAt: new Date("2026-04-01T00:00:00Z"),
      owner: { id: 1, email: "o@o", name: "O" },
    };
    const p = promptModel();
    (p.findMany as FindManyMock)
      .mockResolvedValueOnce([dueSoon])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    for (const m of [skillModel(), contextModel(), buildModel()]) {
      wireEmptySweep(m.findMany as FindManyMock);
    }

    const { runGovernanceSweepWithGate } = await load();
    const result = await runGovernanceSweepWithGate({
      now: new Date("2026-05-01T00:00:00Z"),
    });

    expect(result.dryRun).toBe(true);
    expect(p.update).not.toHaveBeenCalled();
    expect(sendBrandedEmail).not.toHaveBeenCalled();
  });
});

describe("recomputeSmartPicks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendBrandedEmail.mockClear();
  });

  it("flips isSmartPick on/off based on top-scored IDs", async () => {
    vi.resetModules();
    const p = promptModel();
    p.findMany.mockReset();
    p.updateMany.mockReset();
    // eligiblePromptIds
    (p.findMany as FindManyMock).mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    // listCurrentSmartPicks — currently marks id=3 (which is no longer top).
    (p.findMany as FindManyMock).mockResolvedValueOnce([{ id: 3 }]);

    (ratingModel("rating").findMany as FindManyMock).mockResolvedValueOnce([
      { promptId: 1, value: 5, feedbackFlags: ["WORKED_WELL"] },
      { promptId: 1, value: 5, feedbackFlags: [] },
      { promptId: 2, value: 1, feedbackFlags: ["DID_NOT_WORK"] },
    ]);

    for (const m of [skillModel(), contextModel(), buildModel()]) {
      wireSmartPicksEmpty(m);
    }
    for (const r of ["skillRating", "contextRating", "buildRating"] as const) {
      (ratingModel(r).findMany as FindManyMock).mockResolvedValue([]);
    }

    const { recomputeSmartPicks } = await load();
    const changed = await recomputeSmartPicks({ now: new Date("2026-05-01T00:00:00Z") });

    // 2 new picks enabled (1,2) + 1 stale pick disabled (3) = 3 flips.
    expect(changed).toBeGreaterThanOrEqual(3);
    // Enabled the new top IDs.
    expect(p.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: expect.arrayContaining([1, 2]) } },
        data: { isSmartPick: true },
      }),
    );
    // Disabled the stale pick.
    expect(p.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [3] } },
        data: { isSmartPick: false },
      }),
    );
  });
});
