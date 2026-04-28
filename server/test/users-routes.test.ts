import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUserFindFirst,
  mockCollectionUserCount,
  mockUserProfileFavoriteCount,
  mockUserProfileFavoriteFindUnique,
  mockUserProfileFavoriteDelete,
  mockUserProfileFavoriteCreate,
} = vi.hoisted(() => ({
  mockUserFindFirst: vi.fn(),
  mockCollectionUserCount: vi.fn(),
  mockUserProfileFavoriteCount: vi.fn(),
  mockUserProfileFavoriteFindUnique: vi.fn(),
  mockUserProfileFavoriteDelete: vi.fn(),
  mockUserProfileFavoriteCreate: vi.fn(),
}));

vi.mock("../src/middleware/auth", () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOnboardingComplete: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireWriteAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuthContext: () => ({ userId: 1, teamId: 10, role: "MEMBER", userOu: null }),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: mockUserFindFirst,
    },
    collectionUser: {
      count: mockCollectionUserCount,
    },
    userProfileFavorite: {
      count: mockUserProfileFavoriteCount,
      findUnique: mockUserProfileFavoriteFindUnique,
      delete: mockUserProfileFavoriteDelete,
      create: mockUserProfileFavoriteCreate,
    },
  },
}));

function buildUsersApp() {
  return import("../src/routes/users").then(({ usersRouter }) => {
    const app = express();
    app.use(express.json());
    app.use("/api/users", usersRouter);
    return app;
  });
}

describe("GET /api/users/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when user is not on the same team", async () => {
    const app = await buildUsersApp();
    mockUserFindFirst.mockResolvedValue(null);

    const response = await request(app).get("/api/users/42");

    expect(response.status).toBe(404);
    expect(mockCollectionUserCount).not.toHaveBeenCalled();
  });

  it("returns profile with counts and favoritedByMe", async () => {
    const app = await buildUsersApp();
    mockUserFindFirst.mockResolvedValue({
      id: 2,
      name: "Sam",
      avatarUrl: null,
      ou: "Sales",
      region: "AMER",
      title: "AE",
    });
    mockCollectionUserCount.mockResolvedValue(4);
    mockUserProfileFavoriteCount.mockResolvedValue(11);
    mockUserProfileFavoriteFindUnique.mockResolvedValue(null);

    const response = await request(app).get("/api/users/2");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: 2,
      name: "Sam",
      ou: "Sales",
      region: "AMER",
      collectionAddsCount: 4,
      favoriteCount: 11,
      favoritedByMe: false,
    });
    expect(mockCollectionUserCount).toHaveBeenCalledWith({
      where: {
        userId: 2,
        collection: { teamId: 10 },
      },
    });
  });
});

describe("POST /api/users/:id/favorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when favoriting self", async () => {
    const app = await buildUsersApp();

    const response = await request(app).post("/api/users/1/favorite");

    expect(response.status).toBe(400);
  });

  it("creates favorite when none exists", async () => {
    const app = await buildUsersApp();
    mockUserFindFirst.mockResolvedValue({ id: 3 });
    mockUserProfileFavoriteFindUnique.mockResolvedValue(null);
    mockUserProfileFavoriteCreate.mockResolvedValue({});

    const response = await request(app).post("/api/users/3/favorite");

    expect(response.status).toBe(200);
    expect(response.body.data.favorited).toBe(true);
    expect(mockUserProfileFavoriteCreate).toHaveBeenCalledWith({
      data: { fanUserId: 1, targetUserId: 3 },
    });
  });

  it("removes favorite when one exists", async () => {
    const app = await buildUsersApp();
    mockUserFindFirst.mockResolvedValue({ id: 3 });
    mockUserProfileFavoriteFindUnique.mockResolvedValue({ id: 99 });
    mockUserProfileFavoriteDelete.mockResolvedValue({});

    const response = await request(app).post("/api/users/3/favorite");

    expect(response.status).toBe(200);
    expect(response.body.data.favorited).toBe(false);
    expect(mockUserProfileFavoriteDelete).toHaveBeenCalled();
  });
});
