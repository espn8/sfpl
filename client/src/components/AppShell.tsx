import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { fetchMe, updateMyProfile, uploadProfilePhoto } from "../features/auth/api";
import { canAccessAdminUi, canCreateContent } from "../features/auth/roles";
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

function HelpCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
  });

  const defaultProfilePhotoUrl = "https://api.dicebear.com/9.x/bottts/svg?seed=AILibrary";
  const [name, setName] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(defaultProfilePhotoUrl);
  const [region, setRegion] = useState("");
  const [ou, setOu] = useState("");
  const [title, setTitle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!meQuery.data) {
      return;
    }
    setName(meQuery.data.name ?? "");
    setProfilePhotoUrl(meQuery.data.avatarUrl ?? defaultProfilePhotoUrl);
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
    },
    onError: () => {
      setFormError("Unable to save your profile. Please try again.");
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: uploadProfilePhoto,
    onSuccess: async (updatedUser) => {
      queryClient.setQueryData(["auth", "me"], updatedUser);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setProfilePhotoUrl(updatedUser.avatarUrl ?? defaultProfilePhotoUrl);
      setFormError(null);
    },
    onError: () => {
      setFormError("Unable to upload profile photo. Please try again.");
    },
  });

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setFormError("Please select a JPEG, PNG, GIF, or WebP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormError("Image must be less than 5MB.");
      return;
    }

    uploadPhotoMutation.mutate(file);
  };

  const showWelcomeModal = Boolean(meQuery.data && !meQuery.data.onboardingCompleted);

  return (
    <main className="min-h-screen bg-(--color-bg) text-(--color-text)">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="mb-6 flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <a
                href="/"
                className="inline-flex items-center gap-2 focus-visible:outline-none"
                aria-label="SF AI Library home"
                onClick={(e) => {
                  e.preventDefault();
                  navigate({ pathname: "/", search: "" }, { replace: false });
                }}
              >
                <img src={SALESFORCE_LOGO} alt="" className="h-10 w-auto object-contain" />
                <span className="hidden font-semibold text-(--color-text) sm:inline">AI Library</span>
              </a>
            </div>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/prompts">
                Prompts
              </Link>
              <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/skills">
                Skills
              </Link>
              <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/context">
                Context
              </Link>
              <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/builds">
                Builds
              </Link>
              <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/collections">
                Collections
              </Link>
              {meQuery.data && canAccessAdminUi(meQuery.data.role) ? (
                <>
                  <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/analytics">
                    Analytics
                  </Link>
                  <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/admin/tool-requests">
                    Tool Requests
                  </Link>
                </>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {canCreateContent(meQuery.data?.role) && (
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
                    <Link
                      to="/builds/new"
                      className="block px-4 py-2 text-sm text-(--color-text) hover:bg-(--color-surface-muted) focus-visible:bg-(--color-surface-muted) focus-visible:outline-none"
                      role="menuitem"
                      onClick={() => setCreateMenuOpen(false)}
                    >
                      New Build
                    </Link>
                  </div>
                )}
              </div>
            )}
            {meQuery.data ? (
              <Link
                to="/settings"
                className="rounded-full border border-(--color-border) p-0.5 focus-visible:outline-none"
                aria-label="Settings"
              >
                <img
                  src={meQuery.data.avatarUrl ?? defaultProfilePhotoUrl}
                  alt={meQuery.data.name ? `${meQuery.data.name}'s profile photo` : "User profile photo"}
                  className="h-8 w-8 rounded-full object-cover"
                />
              </Link>
            ) : null}
            <Link
              to="/help"
              className="rounded-full border border-(--color-border) p-1.5 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text) focus-visible:outline-none"
              aria-label="Help"
            >
              <HelpCircleIcon className="h-5 w-5" />
            </Link>
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
            .{" "}
            <Link to="/changelog" className="underline hover:no-underline">
              v{import.meta.env.VITE_APP_VERSION}
            </Link>
          </div>
        </footer>
      </div>
      {showWelcomeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-lg">
            <h2 className="text-xl font-semibold">Welcome to Your AI Toolkit</h2>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              Complete your profile to get started. It only takes a moment.
            </p>

            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!name || !profilePhotoUrl) {
                  setFormError("Name and profile photo are required.");
                  return;
                }
                updateProfileMutation.mutate({
                  name,
                  avatarUrl: profilePhotoUrl,
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
                <p className="mb-2 text-sm">Profile Photo</p>
                <div className="flex items-center gap-3 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
                  <img src={profilePhotoUrl} alt="Current profile photo" className="h-16 w-16 rounded object-cover" />
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-(--color-text-muted)">
                      Upload a new profile photo or keep your current one.
                    </p>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadPhotoMutation.isPending}
                        className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm hover:bg-(--color-surface-muted) disabled:opacity-60"
                      >
                        {uploadPhotoMutation.isPending ? "Uploading..." : "Change Photo"}
                      </button>
                    </div>
                  </div>
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

              <div className="mt-4 flex justify-end gap-2 border-t border-(--color-border) pt-4">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="rounded bg-(--color-primary) px-4 py-2 text-(--color-text-inverse) hover:bg-(--color-primary-active) active:bg-(--color-primary-active) disabled:opacity-60"
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Get Started"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
