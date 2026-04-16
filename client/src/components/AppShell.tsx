import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { fetchMe, logout, updateMyProfile } from "../features/auth/api";
import { canAccessAdminUi } from "../features/auth/roles";
import { ThemeModeToggle } from "./ui/ThemeModeToggle";

const SALESFORCE_LOGO = "/salesforce-logo.png";

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m19 9-5 5-4-4-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

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
  const defaultAvatarUrl = "https://api.dicebear.com/9.x/bottts/svg?seed=AILibrary";
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatarUrl);
  const [region, setRegion] = useState("");
  const [ou, setOu] = useState("");
  const [title, setTitle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!createMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!createMenuRef.current?.contains(e.target as Node)) {
        setCreateMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCreateMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [createMenuOpen]);

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

  const handleLogout = () => {
    void (async () => {
      await logout();
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate("/login");
    })();
  };

  return (
    <main className="min-h-screen bg-(--color-bg) text-(--color-text)">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-6 flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Link to="/" className="inline-flex items-center gap-2 focus-visible:outline-none" aria-label="SF AI Library home">
                <img src={SALESFORCE_LOGO} alt="" className="h-10 w-auto object-contain" />
                <span className="hidden font-semibold text-(--color-text) sm:inline">AI Library</span>
              </Link>
            </div>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/">
                Prompts
              </Link>
              <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/skills">
                Skills
              </Link>
              <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/context">
                Context
              </Link>
              <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/collections">
                Collections
              </Link>
              {meQuery.data && canAccessAdminUi(meQuery.data.role) ? (
                <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/analytics">
                  Analytics
                </Link>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" ref={createMenuRef}>
              <button
                type="button"
                onClick={() => setCreateMenuOpen(!createMenuOpen)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-(--color-launch) px-4 py-2 text-sm font-semibold text-white shadow-sm transition-[background-color,box-shadow,transform] hover:bg-(--color-launch-hover) hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-launch) focus-visible:ring-offset-2 focus-visible:ring-offset-(--color-surface) active:scale-[0.98]"
                aria-haspopup="true"
                aria-expanded={createMenuOpen}
              >
                <PlusIcon className="h-4 w-4" />
                <span>Create</span>
                <ChevronDownIcon className="h-4 w-4" />
              </button>
              {createMenuOpen && (
                <div
                  className="absolute right-0 z-50 mt-2 w-44 rounded-lg border border-(--color-border) bg-(--color-surface) py-1 shadow-lg"
                  role="menu"
                  aria-orientation="vertical"
                >
                  <Link
                    to="/prompts/new"
                    className="block px-4 py-2 text-sm text-(--color-text) hover:bg-(--color-surface-muted) focus-visible:bg-(--color-surface-muted) focus-visible:outline-none"
                    role="menuitem"
                    onClick={() => setCreateMenuOpen(false)}
                  >
                    New Prompt
                  </Link>
                  <Link
                    to="/skills/new"
                    className="block px-4 py-2 text-sm text-(--color-text) hover:bg-(--color-surface-muted) focus-visible:bg-(--color-surface-muted) focus-visible:outline-none"
                    role="menuitem"
                    onClick={() => setCreateMenuOpen(false)}
                  >
                    New Skill
                  </Link>
                  <Link
                    to="/context/new"
                    className="block px-4 py-2 text-sm text-(--color-text) hover:bg-(--color-surface-muted) focus-visible:bg-(--color-surface-muted) focus-visible:outline-none"
                    role="menuitem"
                    onClick={() => setCreateMenuOpen(false)}
                  >
                    New Context
                  </Link>
                </div>
              )}
            </div>
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
          </div>
        </header>
        {children}
        <footer className="mt-8 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <img src={SALESFORCE_LOGO} alt="Salesforce" className="h-9 w-auto object-contain" />
            <div className="text-right text-sm text-(--color-text-muted)">
              <Link to="/help" className="underline hover:no-underline mr-4">
                Help
              </Link>
              <a
                href="https://salesforce.enterprise.slack.com/archives/C0ATAP14WEQ"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                #help-ailibrary
              </a>
            </div>
          </div>
          <div className="mt-2 text-right text-sm text-(--color-text-muted)">
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
          </div>
        </footer>
      </div>
      {showProfileModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-lg">
            <h2 className="text-xl font-semibold">
              {showWelcomeModal ? "Welcome to Your AI Toolkit" : "Your Profile"}
            </h2>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              {showWelcomeModal
                ? "Complete your profile to get started. It only takes a moment."
                : "Manage your profile, preferences, and account settings."}
            </p>
            {meQuery.data ? (
              <div className="mt-4 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
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

            <nav className="mt-4 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
              <p className="mb-3 text-sm font-medium text-(--color-text)">Quick Links</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/?mine=true"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm hover:bg-(--color-surface-muted)"
                >
                  <DocumentIcon className="h-4 w-4" />
                  My Content
                </Link>
                <Link
                  to="/?mine=true&showAnalytics=true"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm hover:bg-(--color-surface-muted)"
                >
                  <ChartIcon className="h-4 w-4" />
                  My Analytics
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm hover:bg-(--color-surface-muted)"
                >
                  <SettingsIcon className="h-4 w-4" />
                  Settings
                </Link>
              </div>
            </nav>

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

              <div className="mt-4 flex flex-col-reverse gap-3 border-t border-(--color-border) pt-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5 text-sm hover:bg-(--color-surface) focus-visible:outline-none sm:self-start"
                  onClick={handleLogout}
                >
                  Logout
                </button>
                <div className="flex justify-end gap-2">
                  {!showWelcomeModal ? (
                    <button
                      type="button"
                      className="rounded border border-(--color-border) bg-(--color-surface-muted) px-4 py-2"
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
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
