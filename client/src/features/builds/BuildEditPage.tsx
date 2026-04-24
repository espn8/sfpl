import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { trackEvent } from "../../app/analytics";
import { ConfirmDeleteModal } from "../../components/ConfirmDeleteModal";
import { sanitizeTitle } from "../../lib/sanitizeTitle";
import { SummaryField } from "../assets/SummaryField";
import { fetchMe } from "../auth/api";
import { canPermanentlyDeleteAsset } from "../auth/roles";
import {
  deleteBuildPermanently,
  getBuild,
  regenerateBuildThumbnail,
  updateBuild,
  uploadBuildThumbnail,
} from "./api";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function BuildEditPage() {
  const params = useParams();
  const buildId = Number(params.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreview(null);
      return;
    }
    const url = URL.createObjectURL(thumbnailFile);
    setThumbnailPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [thumbnailFile]);

  const buildQuery = useQuery({
    queryKey: ["build", buildId],
    queryFn: () => getBuild(buildId),
    enabled: Number.isInteger(buildId) && buildId > 0,
  });
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateBuild>[1]) => updateBuild(buildId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["build", buildId] });
      void queryClient.invalidateQueries({ queryKey: ["builds"] });
      navigate(`/builds/${buildId}`);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadBuildThumbnail(buildId, file),
    onSuccess: () => {
      setThumbnailFile(null);
      setThumbnailError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      void queryClient.invalidateQueries({ queryKey: ["build", buildId] });
      void queryClient.invalidateQueries({ queryKey: ["builds"] });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateBuildThumbnail(buildId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["build", buildId] });
      void queryClient.invalidateQueries({ queryKey: ["builds"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteBuildPermanently(buildId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["builds"] });
      trackEvent("build_delete", { build_id: buildId });
      navigate("/");
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setThumbnailError(null);
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setThumbnailFile(null);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setThumbnailError("Image must be JPEG, PNG, GIF, or WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setThumbnailError("Image must be smaller than 5 MB.");
      event.target.value = "";
      return;
    }
    setThumbnailFile(file);
  };

  const handleRemoveImage = () => {
    setThumbnailFile(null);
    setThumbnailError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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
  const me = meQuery.data;
  const canDeleteAsset = me != null && canPermanentlyDeleteAsset(me.role, me.id, build.owner.id);

  return (
    <div className="space-y-4">
    <section className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4">
      <h2 className="text-2xl font-semibold">Thumbnail image</h2>
      <div className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4">
        <p className="text-sm text-(--color-text-muted)">
          Upload your own image or keep using the AI-generated one. Uploaded images appear instead of the AI thumbnail.
        </p>
      </div>
      <div className="flex items-start gap-4">
        {build.thumbnailUrl ? (
          <img
            src={build.thumbnailUrl}
            alt="Current thumbnail"
            className="h-28 w-28 rounded border border-(--color-border) object-cover"
          />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center rounded border border-dashed border-(--color-border) text-xs text-(--color-text-muted)">
            No image
          </div>
        )}
        <div className="flex-1 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileChange}
            className="block w-full text-sm"
          />
          <p className="text-xs text-(--color-text-muted)">
            JPEG, PNG, GIF, or WebP, up to 5 MB.
          </p>
          {thumbnailError ? (
            <p className="text-xs text-red-600" role="alert">
              {thumbnailError}
            </p>
          ) : null}
          {thumbnailPreview ? (
            <div className="flex items-start gap-3">
              <img
                src={thumbnailPreview}
                alt="Thumbnail preview"
                className="h-24 w-24 rounded border border-(--color-border) object-cover"
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (thumbnailFile) uploadMutation.mutate(thumbnailFile);
                  }}
                  disabled={uploadMutation.isPending}
                  className="rounded bg-(--color-primary) px-3 py-1 text-sm text-white hover:bg-(--color-primary-active) disabled:opacity-50"
                >
                  {uploadMutation.isPending ? "Uploading…" : "Upload image"}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1 text-xs hover:bg-(--color-surface-muted)"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          {uploadMutation.isError ? (
            <p className="text-xs text-red-600" role="alert">
              Could not upload image. Please try again.
            </p>
          ) : null}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1 text-xs hover:bg-(--color-surface-muted) disabled:opacity-50"
            >
              {regenerateMutation.isPending ? "Generating…" : "Use AI-generated image instead"}
            </button>
            {regenerateMutation.isError ? (
              <p className="mt-1 text-xs text-red-600" role="alert">
                Could not start AI regeneration.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
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
      <SummaryField
        assetType="build"
        defaultValue={build.summary ?? ""}
        title={build.title}
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
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={updateMutation.isPending}
          className="rounded bg-(--color-primary) px-4 py-2 text-white hover:bg-(--color-primary-active) disabled:opacity-50"
        >
          {updateMutation.isPending ? "Saving…" : "Save"}
        </button>
        {canDeleteAsset ? (
          <button
            type="button"
            className="rounded border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            disabled={deleteMutation.isPending || updateMutation.isPending}
            onClick={() => setShowDeleteModal(true)}
          >
            Delete
          </button>
        ) : null}
      </div>
      {deleteMutation.isError ? (
        <p className="text-sm text-red-600" role="alert">
          Could not delete this build. Please try again.
        </p>
      ) : null}
    </form>
    <ConfirmDeleteModal
      isOpen={showDeleteModal}
      title="Delete build"
      assetType="build"
      assetName={build.title}
      isDeleting={deleteMutation.isPending}
      onConfirm={() => deleteMutation.mutate()}
      onCancel={() => setShowDeleteModal(false)}
    />
    </div>
  );
}
