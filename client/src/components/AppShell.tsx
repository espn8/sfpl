import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { fetchMe, logout, updateMyProfile } from "../features/auth/api";
import { ThemeModeToggle } from "./ui/ThemeModeToggle";

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
  const [avatarUrl, setAvatarUrl] = useState("");
  const [region, setRegion] = useState("");
  const [ou, setOu] = useState("");
  const [title, setTitle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const avatarChoices = [
    "https://api.dicebear.com/9.x/bottts/svg?seed=Astra",
    "https://api.dicebear.com/9.x/bottts/svg?seed=Nova",
    "https://api.dicebear.com/9.x/bottts/svg?seed=Orion",
    "https://api.dicebear.com/9.x/bottts/svg?seed=Ember",
  ];
  const googleAvatarUrl =
    meQuery.data?.avatarUrl && !avatarChoices.includes(meQuery.data.avatarUrl)
      ? meQuery.data.avatarUrl
      : null;
  const selectableAvatarChoices = googleAvatarUrl ? [googleAvatarUrl, ...avatarChoices] : avatarChoices;

  useEffect(() => {
    if (!meQuery.data) {
      return;
    }
    setName(meQuery.data.name ?? "");
    setAvatarUrl(meQuery.data.avatarUrl ?? avatarChoices[0]);
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
          <nav className="flex gap-4 text-sm">
            <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/">
              Prompts
            </Link>
            <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/prompts/new">
              New Prompt
            </Link>
            <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/collections">
              Collections
            </Link>
            <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/analytics">
              Analytics
            </Link>
            <Link className="rounded px-1 py-0.5 hover:underline focus-visible:outline-none" to="/settings">
              Settings
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            {meQuery.data ? (
              <button
                type="button"
                className="rounded-full border border-(--color-border) p-0.5 focus-visible:outline-none"
                onClick={() => {
                  setFormError(null);
                  setIsProfileModalOpen(true);
                }}
                aria-label="Edit profile"
              >
                <img
                  src={meQuery.data.avatarUrl ?? avatarChoices[0]}
                  alt={meQuery.data.name ? `${meQuery.data.name} avatar` : "User avatar"}
                  className="h-8 w-8 rounded-full object-cover"
                />
              </button>
            ) : null}
            <ThemeModeToggle />
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
      </div>
      {showProfileModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-lg">
            <h2 className="text-xl font-semibold">
              {showWelcomeModal ? "Welcome to Prompt Library" : "Update your profile"}
            </h2>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              {showWelcomeModal
                ? "Please finish your profile before continuing."
                : "Update how your profile appears across Prompt Library."}
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
                <div className="grid grid-cols-4 gap-3">
                  {selectableAvatarChoices.map((choice, index) => (
                    <button
                      key={choice}
                      type="button"
                      className={`rounded border p-1 ${avatarUrl === choice ? "border-(--color-primary)" : "border-(--color-border)"}`}
                      onClick={() => setAvatarUrl(choice)}
                    >
                      <img
                        src={choice}
                        alt={index === 0 && googleAvatarUrl === choice ? "Google profile photo option" : "Avatar option"}
                        className="h-16 w-16 rounded object-cover"
                      />
                    </button>
                  ))}
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
                  className="rounded bg-(--color-primary) px-4 py-2 text-(--color-text-inverse) disabled:opacity-60"
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
