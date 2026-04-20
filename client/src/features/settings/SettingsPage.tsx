import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { fetchMe, logout, updateMyProfile, uploadProfilePhoto } from "../auth/api";
import { ThemeModeToggle } from "../../components/ui/ThemeModeToggle";

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
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

export function SettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!meQuery.data) return;
    setName(meQuery.data.name ?? "");
    setProfilePhotoUrl(meQuery.data.avatarUrl ?? defaultProfilePhotoUrl);
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
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: () => {
      setFormError("Unable to save your profile. Please try again.");
      setSaveSuccess(false);
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: uploadProfilePhoto,
    onSuccess: async (updatedUser) => {
      queryClient.setQueryData(["auth", "me"], updatedUser);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setProfilePhotoUrl(updatedUser.avatarUrl ?? defaultProfilePhotoUrl);
      setFormError(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: () => {
      setFormError("Unable to upload profile photo. Please try again.");
      setSaveSuccess(false);
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

  const handleLogout = () => {
    void (async () => {
      await logout();
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate("/login");
    })();
  };

  const handleSubmit = (event: React.FormEvent) => {
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
  };

  if (meQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-(--color-text-muted)">Loading settings...</p>
      </div>
    );
  }

  if (!meQuery.data) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-(--color-text-muted)">Unable to load settings. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

      <div className="space-y-6">
        <section className="rounded-lg border border-(--color-border) bg-(--color-surface) p-6">
          <h2 className="mb-4 text-lg font-medium">Your Content</h2>
          <p className="mb-4 text-sm text-(--color-text-muted)">
            View and manage the prompts, skills, and context documents you've created.
          </p>
          <Link
            to="/?mine=true"
            className="flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-4 py-3 transition-colors hover:bg-(--color-surface)"
          >
            <div className="flex items-center gap-3">
              <DocumentIcon className="h-5 w-5 text-(--color-text-muted)" />
              <div>
                <p className="font-medium">My Content</p>
                <p className="text-sm text-(--color-text-muted)">View and edit prompts, skills, and context you've created</p>
              </div>
            </div>
            <ChevronRightIcon className="h-5 w-5 text-(--color-text-muted)" />
          </Link>
        </section>

        <section className="rounded-lg border border-(--color-border) bg-(--color-surface) p-6">
          <h2 className="mb-4 text-lg font-medium">Your Analytics</h2>
          <p className="mb-4 text-sm text-(--color-text-muted)">
            See how your created content is performing with views, uses, ratings, and favorites.
          </p>
          <div className="space-y-2">
            <Link
              to="/?mine=true&showAnalytics=true"
              className="flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-4 py-3 transition-colors hover:bg-(--color-surface)"
            >
              <div className="flex items-center gap-3">
                <ChartIcon className="h-5 w-5 text-(--color-text-muted)" />
                <div>
                  <p className="font-medium">My Prompt Analytics</p>
                  <p className="text-sm text-(--color-text-muted)">Views, uses, ratings, and favorites for your prompts</p>
                </div>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-(--color-text-muted)" />
            </Link>
            <Link
              to="/skills?mine=true&showAnalytics=true"
              className="flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-4 py-3 transition-colors hover:bg-(--color-surface)"
            >
              <div className="flex items-center gap-3">
                <ChartIcon className="h-5 w-5 text-(--color-text-muted)" />
                <div>
                  <p className="font-medium">My Skill Analytics</p>
                  <p className="text-sm text-(--color-text-muted)">Views and engagement for your skills</p>
                </div>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-(--color-text-muted)" />
            </Link>
            <Link
              to="/context?mine=true&showAnalytics=true"
              className="flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-4 py-3 transition-colors hover:bg-(--color-surface)"
            >
              <div className="flex items-center gap-3">
                <ChartIcon className="h-5 w-5 text-(--color-text-muted)" />
                <div>
                  <p className="font-medium">My Context Analytics</p>
                  <p className="text-sm text-(--color-text-muted)">Views and engagement for your context documents</p>
                </div>
              </div>
              <ChevronRightIcon className="h-5 w-5 text-(--color-text-muted)" />
            </Link>
          </div>
        </section>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <section className="rounded-lg border border-(--color-border) bg-(--color-surface) p-6">
          <h2 className="mb-4 text-lg font-medium">Account Information</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-(--color-text-muted)">Email</dt>
              <dd className="mt-1 font-medium">{meQuery.data.email}</dd>
            </div>
            <div>
              <dt className="text-(--color-text-muted)">Role</dt>
              <dd className="mt-1 font-medium">{meQuery.data.role}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-(--color-border) bg-(--color-surface) p-6">
          <h2 className="mb-4 text-lg font-medium">Appearance</h2>
          <ThemeModeToggle />
        </section>

        <section className="rounded-lg border border-(--color-border) bg-(--color-surface) p-6">
          <h2 className="mb-4 text-lg font-medium">Profile</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={profilePhotoUrl}
                alt="Your profile photo"
                className="h-16 w-16 rounded-full border border-(--color-border) object-cover"
              />
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
                    className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-1.5 text-sm hover:bg-(--color-surface) disabled:opacity-60"
                  >
                    {uploadPhotoMutation.isPending ? "Uploading..." : "Change Photo"}
                  </button>
                </div>
              </div>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Display name</span>
              <input
                type="text"
                className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Title</span>
              <input
                type="text"
                className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Region</span>
                <select
                  className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  <option value="">Select Region</option>
                  <option value="AMER">AMER</option>
                  <option value="JAPAC">JAPAC</option>
                  <option value="LATAM">LATAM</option>
                  <option value="EMEA">EMEA</option>
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">OU</span>
                <select
                  className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                  value={ou}
                  onChange={(e) => setOu(e.target.value)}
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
          </div>
        </section>

        {formError && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
            {formError}
          </div>
        )}

        {saveSuccess && (
          <div className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400">
            Profile saved successfully!
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="rounded border border-(--color-border) bg-(--color-surface-muted) px-4 py-2 text-sm hover:bg-(--color-surface) focus-visible:outline-none"
            onClick={handleLogout}
          >
            Logout
          </button>
          <button
            type="submit"
            disabled={updateProfileMutation.isPending}
            className="rounded bg-(--color-primary) px-4 py-2 text-sm font-medium text-(--color-text-inverse) hover:bg-(--color-primary-active) active:bg-(--color-primary-active) disabled:opacity-60"
          >
            {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
