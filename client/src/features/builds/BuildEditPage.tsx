import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { sanitizeTitle } from "../../lib/sanitizeTitle";
import { getBuild, updateBuild } from "./api";

export function BuildEditPage() {
  const params = useParams();
  const buildId = Number(params.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [validationError, setValidationError] = useState<string | null>(null);

  const buildQuery = useQuery({
    queryKey: ["build", buildId],
    queryFn: () => getBuild(buildId),
    enabled: Number.isInteger(buildId) && buildId > 0,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateBuild>[1]) => updateBuild(buildId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["build", buildId] });
      void queryClient.invalidateQueries({ queryKey: ["builds"] });
      navigate(`/builds/${buildId}`);
    },
  });

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  if (!Number.isInteger(buildId) || buildId <= 0) {
    return <p className="text-sm text-(--color-text-muted)">Invalid build.</p>;
  }

  if (buildQuery.isLoading || !buildQuery.data) {
    return <p className="text-sm text-(--color-text-muted)">Loading…</p>;
  }

  if (buildQuery.isError) {
    return <p className="text-sm text-red-600">Could not load build.</p>;
  }

  const build = buildQuery.data;

  return (
    <form
      className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4"
      key={build.updatedAt}
      onSubmit={(event) => {
        event.preventDefault();
        setValidationError(null);
        const formData = new FormData(event.currentTarget);
        const title = sanitizeTitle(String(formData.get("title") ?? ""));
        const summary = String(formData.get("summary") ?? "").trim();
        const buildUrl = String(formData.get("buildUrl") ?? "").trim();
        const supportUrl = String(formData.get("supportUrl") ?? "").trim();
        const status = String(formData.get("status") ?? build.status) as typeof build.status;
        const visibility = String(formData.get("visibility") ?? build.visibility) as typeof build.visibility;

        if (!title) {
          setValidationError("Title is required.");
          return;
        }
        if (!buildUrl) {
          setValidationError("Build URL is required.");
          return;
        }
        if (!isValidUrl(buildUrl)) {
          setValidationError("Build URL must be a valid URL (e.g., https://example.com).");
          return;
        }
        if (supportUrl && !isValidUrl(supportUrl)) {
          setValidationError("Support URL must be a valid URL if provided.");
          return;
        }

        updateMutation.mutate({
          title,
          summary: summary || undefined,
          buildUrl,
          supportUrl: supportUrl || undefined,
          status,
          visibility,
        });
      }}
    >
      <h2 className="text-2xl font-semibold">Edit Build</h2>
      <div className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4">
        <p className="text-sm text-(--color-text-muted)">
          <strong>Builds</strong> are functional tools and applications you can use, deploy, or demo. 
          Examples include Custom GPTs, web apps, dashboards, Chrome extensions, automated workflows, 
          API services, and demo assets like LWCs or Packages.
        </p>
      </div>
      <input
        name="title"
        defaultValue={build.title}
        required
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <input
        name="summary"
        defaultValue={build.summary ?? ""}
        placeholder="Summary (optional) - Brief description of what this build does"
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <div className="grid gap-2 md:grid-cols-2">
        <select
          name="status"
          defaultValue={build.status}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          name="visibility"
          defaultValue={build.visibility}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="PUBLIC">Public (All Users)</option>
          <option value="TEAM">Team (My OU Only)</option>
          <option value="PRIVATE">Private (Only Me)</option>
        </select>
      </div>
      
      <div className="space-y-3 rounded border border-(--color-border) bg-(--color-surface-muted) p-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Build URL <span className="text-red-500">*</span>
          </label>
          <input
            name="buildUrl"
            type="url"
            defaultValue={build.buildUrl}
            required
            className="w-full rounded border border-(--color-border) bg-(--color-surface) px-3 py-2"
          />
          <p className="mt-1 text-xs text-(--color-text-muted)">
            The main link to access or use this build (e.g., Custom GPT URL, web app, etc.)
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Documentation URL <span className="text-(--color-text-muted)">(optional)</span>
          </label>
          <input
            name="supportUrl"
            type="url"
            defaultValue={build.supportUrl ?? ""}
            className="w-full rounded border border-(--color-border) bg-(--color-surface) px-3 py-2"
          />
          <p className="mt-1 text-xs text-(--color-text-muted)">
            Link to documentation, README, help page, or any supporting resources
          </p>
        </div>
      </div>

      {validationError ? (
        <p className="text-sm text-red-600" role="alert">
          {validationError}
        </p>
      ) : null}
      {updateMutation.isError ? (
        <p className="text-sm text-red-600" role="alert">
          Could not save changes.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={updateMutation.isPending}
        className="rounded bg-(--color-primary) px-4 py-2 text-white hover:bg-(--color-primary-active) disabled:opacity-50"
      >
        {updateMutation.isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
