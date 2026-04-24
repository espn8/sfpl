import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPrismaMock } from "./helpers/mockPrisma";

const prismaMock = buildPrismaMock();

vi.mock("../src/lib/prisma", () => ({
  prisma: prismaMock,
}));

const promptModel = prismaMock.prompt as Record<string, ReturnType<typeof vi.fn>>;
const buildModel = prismaMock.build as Record<string, ReturnType<typeof vi.fn>>;
const verificationModel = prismaMock.assetVerification as Record<string, ReturnType<typeof vi.fn>>;

async function load() {
  return await import("../src/services/governanceOps");
}

describe("governanceOps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifyAsset sets lastVerifiedAt and a 30-day dueAt and writes a VERIFIED audit row", async () => {
    const ops = await load();
    await ops.verifyAsset("PROMPT", 11, 42);
    expect(promptModel.update).toHaveBeenCalledTimes(1);
    const args = promptModel.update.mock.calls[0][0] as { where: { id: number }; data: Record<string, unknown> };
    expect(args.where).toEqual({ id: 11 });
    expect(args.data.warningSentAt).toBeNull();
    const last = args.data.lastVerifiedAt as Date;
    const due = args.data.verificationDueAt as Date;
    expect(due.getTime() - last.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(verificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assetType: "PROMPT", assetId: 11, userId: 42, action: "VERIFIED" }),
      }),
    );
  });

  it("unarchiveAsset republishes and clears archive fields", async () => {
    const ops = await load();
    await ops.unarchiveAsset("BUILD", 7, 9);
    expect(buildModel.update).toHaveBeenCalledTimes(1);
    const args = buildModel.update.mock.calls[0][0] as { where: { id: number }; data: Record<string, unknown> };
    expect(args.data.status).toBe("PUBLISHED");
    expect(args.data.archivedAt).toBeNull();
    expect(args.data.archiveReason).toBeNull();
    expect(verificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assetType: "BUILD", assetId: 7, action: "UNARCHIVED" }),
      }),
    );
  });

  it("transferOwner reassigns ownerId and writes an OWNERSHIP_TRANSFERRED audit row", async () => {
    const ops = await load();
    await ops.transferOwner("PROMPT", 3, 1, 2, "User left the business");
    expect(promptModel.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { ownerId: 2 },
    });
    expect(verificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assetType: "PROMPT",
          assetId: 3,
          userId: 1,
          action: "OWNERSHIP_TRANSFERRED",
          notes: "User left the business",
        }),
      }),
    );
  });

  it("logManualArchive stamps MANUAL archive reason", async () => {
    const ops = await load();
    await ops.logManualArchive("PROMPT", 5, 1);
    const args = promptModel.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(args.data.archiveReason).toBe("MANUAL");
    expect(verificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "ARCHIVED", reason: "MANUAL" }),
      }),
    );
  });
});
