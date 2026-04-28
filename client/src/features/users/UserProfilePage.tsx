import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { UserCollectionMenu } from "../../components/UserCollectionMenu";
import { listAssets, type AssetType, type ListAssetsFilters } from "../assets/api";
import { AssetCard } from "../assets/AssetCard";
import { fetchMe } from "../auth/api";
import { HeartIcon } from "../prompts/promptActionIcons";
import { promptOwnerAvatarUrl } from "../prompts/promptTagChips";
import { fetchUserProfile, toggleUserFavorite } from "./api";

const PAGE_SIZE = 20;

export function UserProfilePage() {
  const params = useParams();
  const userId = Number(params.id);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<"recent" | "mostUsed" | "name" | "updatedAt">("recent");
  const [assetType, setAssetType] = useState<"all" | AssetType>("all");

  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe });

  const profileQuery = useQuery({
    queryKey: ["user", userId],
    queryFn: () => fetchUserProfile(userId),
    enabled: Number.isInteger(userId) && userId > 0,
  });

  const apiFilters = useMemo<ListAssetsFilters>(() => {
    const f: ListAssetsFilters = {
      page,
      pageSize: PAGE_SIZE,
      sort,
      assetType,
      ownerId: userId,
      snapshot: false,
    };
    return f;
  }, [page, sort, assetType, userId]);

  const assetsQuery = useQuery({
    queryKey: ["assets", apiFilters],
    queryFn: () => listAssets(apiFilters),
    enabled: Number.isInteger(userId) && userId > 0 && profileQuery.isSuccess,
  });

  const favoriteMutation = useMutation({
    mutationFn: () => toggleUserFavorite(userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user", userId] });
    },
  });

  const isSelf = Boolean(meQuery.data && meQuery.data.id === userId);
  const profile = profileQuery.data;

  if (!Number.isInteger(userId) || userId <= 0) {
    return <p className="text-red-700">Invalid user.</p>;
  }

  if (profileQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--color-primary) border-t-transparent" />
      </div>
    );
  }

  if (profileQuery.isError || !profile) {
    return <p className="text-red-700">User not found.</p>;
  }

  const assets = assetsQuery.data?.data ?? [];
  const totalPages = assetsQuery.data?.meta.totalPages ?? 1;

  const displayName = profile.name ?? `User #${profile.id}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-(--color-border) bg-(--color-surface) text-(--color-text-muted) transition-colors hover:bg-(--color-surface-muted) hover:text-(--color-text)"
          aria-label="Back to home"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">Profile</h1>
      </div>

      <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <img
              src={promptOwnerAvatarUrl(profile)}
              alt=""
              className="h-20 w-20 shrink-0 rounded-full border border-(--color-border) bg-(--color-surface-muted) object-cover"
            />
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold">{displayName}</h2>
              {profile.title ? <p className="text-sm text-(--color-text-muted)">{profile.title}</p> : null}
              <dl className="mt-2 space-y-1 text-sm text-(--color-text-muted)">
                {profile.ou ? (
                  <div>
                    <dt className="inline font-medium text-(--color-text)">OU: </dt>
                    <dd className="inline">{profile.ou}</dd>
                  </div>
                ) : null}
                {profile.region ? (
                  <div>
                    <dt className="inline font-medium text-(--color-text)">Region: </dt>
                    <dd className="inline">{profile.region}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <span className="rounded-full bg-(--color-surface-muted) px-3 py-1 text-(--color-text)">
                  <span className="font-semibold">{profile.collectionAddsCount}</span> in collections
                </span>
                <span className="rounded-full bg-(--color-surface-muted) px-3 py-1 text-(--color-text)">
                  <span className="font-semibold">{profile.favoriteCount}</span> favorites
                </span>
              </div>
            </div>
          </div>

          {!isSelf ? (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={favoriteMutation.isPending}
                onClick={() => favoriteMutation.mutate()}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${
                  profile.favoritedByMe
                    ? "border-(--color-primary) bg-(--color-primary) text-white hover:bg-(--color-primary-hover)"
                    : "border-(--color-border) bg-(--color-surface) hover:bg-(--color-surface-muted)"
                }`}
                aria-pressed={profile.favoritedByMe}
              >
                <HeartIcon className="h-4 w-4" filled={profile.favoritedByMe} />
                {profile.favoritedByMe ? "Favorited" : "Favorite"}
              </button>
              <UserCollectionMenu userId={userId} userName={displayName} />
            </div>
          ) : (
            <p className="text-sm text-(--color-text-muted)">This is your profile.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-(--color-text-muted)">
          Sort
          <select
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value as "recent" | "mostUsed" | "name" | "updatedAt");
            }}
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-2 py-1.5 text-(--color-text)"
          >
            <option value="recent">Recent</option>
            <option value="mostUsed">Most used</option>
            <option value="name">Name</option>
            <option value="updatedAt">Updated</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-(--color-text-muted)">
          Type
          <select
            value={assetType}
            onChange={(e) => {
              setPage(1);
              setAssetType(e.target.value as "all" | AssetType);
            }}
            className="rounded-lg border border-(--color-border) bg-(--color-surface) px-2 py-1.5 text-(--color-text)"
          >
            <option value="all">All</option>
            <option value="prompt">Prompts</option>
            <option value="skill">Skills</option>
            <option value="context">Context</option>
            <option value="build">Builds</option>
          </select>
        </label>
      </div>

      <h3 className="text-lg font-semibold">Published assets you can see</h3>

      {assetsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-(--color-primary) border-t-transparent" />
        </div>
      ) : assetsQuery.isError ? (
        <p className="text-red-700">Could not load assets.</p>
      ) : assets.length === 0 ? (
        <p className="text-(--color-text-muted)">No matching published assets.</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => (
              <AssetCard key={`${asset.assetType}-${asset.id}`} asset={asset} variant="default" />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm font-medium transition-colors hover:bg-(--color-surface-muted) disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 text-sm text-(--color-text-muted)">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm font-medium transition-colors hover:bg-(--color-surface-muted) disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
