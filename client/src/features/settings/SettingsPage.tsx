import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchMe, logout, updateMyProfile } from "../auth/api";
import { ThemeModeToggle } from "../../components/ui/ThemeModeToggle";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
  });

  const defaultAvatarUrl = "https://api.dicebear.com/9.x/bottts/svg?seed=AILibrary";
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(defaultAvatarUrl);
  const [region, setRegion] = useState("");
  const [ou, setOu] = useState("");
  const [title, setTitle] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!meQuery.data) return;
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
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: () => {
      setFormError("Unable to save your profile. Please try again.");
      setSaveSuccess(false);
    },
  });

  const handleLogout = () => {
    void (async () => {
      await logout();
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate("/login");
    })();
  };

  const handleSubmit = (event: React.FormEvent) => {
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

      <form onSubmit={handleSubmit} className="space-y-6">
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
            <div className="sm:col-span-2">
              <dt className="text-(--color-text-muted)">Team ID</dt>
              <dd className="mt-1 font-medium">{meQuery.data.teamId}</dd>
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
                src={avatarUrl}
                alt="Your avatar"
                className="h-16 w-16 rounded-full border border-(--color-border) object-cover"
              />
              <p className="text-sm text-(--color-text-muted)">
                Your avatar comes from your Google profile photo or your uploaded profile image.
              </p>
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
