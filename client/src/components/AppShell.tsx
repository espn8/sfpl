import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { fetchMe, logout, updateMyProfile } from "../features/auth/api";
import { canAccessAdminUi } from "../features/auth/roles";
import { ThemeModeToggle } from "./ui/ThemeModeToggle";

/** Mark-only asset (no wordmark); matches `public/favicon.svg`. */
const salesforceLogoSrc = "/favicon.svg";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
  });

  const [name, setName] = useState("");
  const defaultAvatarUrl = "https://api.dicebear.com/9.x/bottts/svg?seed=PromptLibrary";
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatarUrl);
  const [region, setRegion] = useState("");
  const [ou, setOu] = useState("");
  const [title, setTitle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    if (!meQuery.data) {
      return;
    }
    setName(meQuery.data.name ?? "");
    setAvatarUrl(meQuery.data.avatarUrl ?? defaultAvatarUrl);
    setRegion(meQuery.data.region ?? "");
    setOu(meQuery.data.ou ?? "");
    setTitle(meQuery.data.title ?? "");
  }, [meQuery.data]);

  const updateProfileMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: async (updatedUser) => {
      queryClient.setQueryData(["auth", "me"], updatedUser);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setFormError(null);
      setIsProfileModalOpen(false);
    },
    onError: () => {
      setFormError("Unable to save your profile. Please try again.");
    },
  });

  const showWelcomeModal = Boolean(meQuery.data && !meQuery.data.onboardingCompleted);
  const showProfileModal = showWelcomeModal || isProfileModalOpen;

  return (
    <main className="min-h-screen bg-(--color-bg) text-(--color-text)">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-6 flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="inline-flex items-center focus-visible:outline-none" aria-label="Home">
              <img src={salesforceLogoSrc} alt="" className="block h-10 w-auto max-w-none" />
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/">
                Prompts
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-full bg-linear-to-r from-indigo-500 via-fuchsia-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white no-underline shadow-md shadow-fuchsia-500/30 transition-[filter,box-shadow,transform] hover:brightness-110 hover:shadow-lg hover:shadow-fuchsia-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-surface) active:scale-[0.98] active:brightness-105"
                to="/prompts/new"
              >
                New Prompt
              </Link>
              <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/collections">
                Collections
              </Link>
              {meQuery.data && canAccessAdminUi(meQuery.data.role) ? (
                <>
                  <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/analytics">
                    Analytics
                  </Link>
                  <button
                    type="button"
                    className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none"
                    onClick={() => {
                      setFormError(null);
                      setIsProfileModalOpen(true);
                    }}
                  >
                    Settings
                  </button>
                </>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {meQuery.data ? (
              <button
                type="button"
                className="rounded-full border border-(--color-border) p-0.5 focus-visible:outline-none"
                onClick={() => {
                  setFormError(null);
                  setIsProfileModalOpen(true);
                }}
                aria-label="Account settings"
              >
                <img
                  src={meQuery.data.avatarUrl ?? defaultAvatarUrl}
                  alt={meQuery.data.name ? `${meQuery.data.name} avatar` : "User avatar"}
                  className="h-8 w-8 rounded-full object-cover"
                />
              </button>
            ) : null}
            <button
              type="button"
              className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5 text-sm hover:bg-(--color-surface) focus-visible:outline-none"
              onClick={() => {
                void (async () => {
                  await logout();
                  await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
                  navigate("/login");
                })();
              }}
            >
              Logout
            </button>
          </div>
        </header>
        {children}
        <footer className="mt-8 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <img src={salesforceLogoSrc} alt="Salesforce" className="block h-9 w-auto max-w-none" />
            <p className="text-right text-sm text-(--color-text-muted)">
              Copyright 2026. All Rights Reserved. Created with ❤️ by{" "}
              <a
                href="https://salesforce.enterprise.slack.com/team/U01G89VU4N7"
                target="_blank"
                rel="noreferrer"
                className="underline hover:no-underline"
              >
                Amelia Ochodnicky
              </a>
              .
            </p>
          </div>
        </footer>
      </div>
      {showProfileModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-lg">
            <h2 className="text-xl font-semibold">
              {showWelcomeModal ? "Welcome to Prompt Library" : "Account settings"}
            </h2>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              {showWelcomeModal
                ? "Please finish your profile before continuing."
                : "Your profile, appearance, and account details."}
            </p>
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!name || !avatarUrl || !region || !ou || !title) {
                  setFormError("All fields are required.");
                  return;
                }
                updateProfileMutation.mutate({
                  name,
                  avatarUrl,
                  region,
                  ou,
                  title,
                });
              }}
            >
              {meQuery.data ? (
                <div className="rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
                  <p className="mb-3 text-sm font-medium text-(--color-text)">Account</p>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-(--color-text-muted)">Email</dt>
                      <dd className="mt-0.5 font-medium">{meQuery.data.email}</dd>
                    </div>
                    <div>
                      <dt className="text-(--color-text-muted)">Role</dt>
                      <dd className="mt-0.5 font-medium">{meQuery.data.role}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-(--color-text-muted)">Team ID</dt>
                      <dd className="mt-0.5 font-medium">{meQuery.data.teamId}</dd>
                    </div>
                  </dl>
                </div>
              ) : null}

              <div className="rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
                <p className="mb-2 text-sm text-(--color-text-muted)">Appearance</p>
                <ThemeModeToggle />
              </div>

              <label className="block text-sm">
                <span className="mb-1 block">Display name</span>
                <input
                  type="text"
                  className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>

              <div>
                <p className="mb-2 text-sm">Avatar</p>
                <div className="flex items-center gap-3 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
                  <img src={avatarUrl} alt="Current avatar" className="h-16 w-16 rounded object-cover" />
                  <p className="text-sm text-(--color-text-muted)">
                    Your avatar comes from your Google profile photo or your uploaded profile image.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block">Region</span>
                  <select
                    className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                  >
                    <option value="">Select Region</option>
                    <option value="AMER">AMER</option>
                    <option value="JAPAC">JAPAC</option>
                    <option value="LATAM">LATAM</option>
                    <option value="EMEA">EMEA</option>
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block">OU</span>
                  <select
                    className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                    value={ou}
                    onChange={(event) => setOu(event.target.value)}
                  >
                    <option value="">Select OU</option>
                    <option value="AMER ACC">AMER ACC</option>
                    <option value="AMER PACE">AMER PACE</option>
                    <option value="AMER REG">AMER REG</option>
                    <option value="ANZ">ANZ</option>
                    <option value="EMEA CENTRAL">EMEA CENTRAL</option>
                    <option value="EMEA NORTH">EMEA NORTH</option>
                    <option value="EMEA SOUTH">EMEA SOUTH</option>
                    <option value="FRANCE">FRANCE</option>
                    <option value="GLOBAL PUBSEC">GLOBAL PUBSEC</option>
                    <option value="GLOBAL SMB">GLOBAL SMB</option>
                    <option value="JAPAN / KOREA / TAIWAN">JAPAN / KOREA / TAIWAN</option>
                    <option value="LATAM">LATAM</option>
                    <option value="NEXTGEN PLATFORM">NEXTGEN PLATFORM</option>
                    <option value="SOUTH ASIA">SOUTH ASIA</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block">Title</span>
                <input
                  type="text"
                  className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>

              {formError ? <p className="text-sm text-red-700">{formError}</p> : null}

              <div className="flex justify-end">
                {!showWelcomeModal ? (
                  <button
                    type="button"
                    className="mr-2 rounded border border-(--color-border) bg-(--color-surface-muted) px-4 py-2"
                    onClick={() => {
                      setIsProfileModalOpen(false);
                      setFormError(null);
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="rounded bg-(--color-primary) px-4 py-2 text-(--color-text-inverse) hover:bg-(--color-primary-active) active:bg-(--color-primary-active) disabled:opacity-60"
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
