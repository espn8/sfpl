import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DuplicateWarningModal,
  isDuplicateError,
  type DuplicateMatch,
} from "../../components/DuplicateWarningModal";
import { PublishStatusModal } from "../../components/PublishStatusModal";
import { sanitizeTitle } from "../../lib/sanitizeTitle";
import { SummaryField } from "../assets/SummaryField";
import { AssetTagsField } from "../tags/AssetTagsField";
import { createBuild, uploadBuildThumbnail, type CreateBuildInput } from "./api";

type PendingBuildData = {
  title: string;
  summary?: string;
  buildUrl: string;
  supportUrl?: string;
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  tagIds?: number[];
};

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function BuildEditorPage() {
  const navigate = useNavigate();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<PendingBuildData | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

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

  const createMutation = useMutation({
    mutationFn: async (input: CreateBuildInput) => {
      const build = await createBuild(input);
      if (thumbnailFile) {
        try {
          return await uploadBuildThumbnail(build.id, thumbnailFile);
        } catch (uploadError) {
          console.error("Upload build thumbnail error:", uploadError);
          return build;
        }
      }
      return build;
    },
    onSuccess: (build) => {
      navigate(`/builds/${build.id}`);
    },
    onError: (error) => {
      console.error("Create build error:", error);
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { response?: { data?: unknown } };
        if (isDuplicateError(axiosError.response?.data)) {
          setDuplicateMatches(axiosError.response.data.error.duplicates);
          setShowDuplicateModal(true);
        }
      }
    },
  });

  const handlePublishChoice = (status: "DRAFT" | "PUBLISHED") => {
    if (!pendingFormData) return;
    setShowPublishModal(false);
    createMutation.mutate({
      ...pendingFormData,
      status,
      skipThumbnailGeneration: Boolean(thumbnailFile),
    });
    setPendingFormData(null);
  };

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

  return (
    <form
      className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setValidationError(null);
        const formData = new FormData(event.currentTarget);
        const title = sanitizeTitle(String(formData.get("title") ?? ""));
        const summary = String(formData.get("summary") ?? "").trim();
        const buildUrl = String(formData.get("buildUrl") ?? "").trim();
        const supportUrl = String(formData.get("supportUrl") ?? "").trim();
        const visibility = String(formData.get("visibility") ?? "PUBLIC") as "PUBLIC" | "TEAM" | "PRIVATE";

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
        
        setPendingFormData({
          title,
          summary: summary || undefined,
          buildUrl,
          supportUrl: supportUrl || undefined,
          visibility,
          tagIds: selectedTagIds,
        });
        setShowPublishModal(true);
      }}
    >
      <h2 className="text-2xl font-semibold">Create Build</h2>
      <div className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4">
        <p className="text-sm text-(--color-text-muted)">
          <strong>Builds</strong> are functional tools and applications you can use, deploy, or demo. 
          Examples include Custom GPTs, web apps, dashboards, Chrome extensions, automated workflows, 
          API services, and demo assets like LWCs or Packages.
        </p>
      </div>
      <input
        name="title"
        placeholder="Build name"
        required
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <SummaryField assetType="build" />
      <select
        name="visibility"
        defaultValue="PUBLIC"
        className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      >
        <option value="PUBLIC">Public (All Users)</option>
        <option value="TEAM">Team (My OU Only)</option>
        <option value="PRIVATE">Private (Only Me)</option>
      </select>

      <AssetTagsField canEdit selectedIds={selectedTagIds} onChange={setSelectedTagIds} />

      <div className="space-y-3 rounded border border-(--color-border) bg-(--color-surface-muted) p-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Build URL <span className="text-red-500">*</span>
          </label>
          <input
            name="buildUrl"
            type="url"
            placeholder="https://example.com/my-build"
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
            placeholder="https://docs.example.com/readme"
            className="w-full rounded border border-(--color-border) bg-(--color-surface) px-3 py-2"
          />
          <p className="mt-1 text-xs text-(--color-text-muted)">
            Link to documentation, README, help page, or any supporting resources
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded border border-(--color-border) bg-(--color-surface-muted) p-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Thumbnail image <span className="text-(--color-text-muted)">(optional)</span>
          </label>
          <input
            ref={fileInputRef}
            name="thumbnail"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileChange}
            className="block w-full text-sm"
          />
          <p className="mt-1 text-xs text-(--color-text-muted)">
            Upload your own image (JPEG, PNG, GIF, or WebP, up to 5 MB) or leave blank to auto-generate one with AI.
          </p>
          {thumbnailError ? (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {thumbnailError}
            </p>
          ) : null}
          {thumbnailPreview ? (
            <div className="mt-3 flex items-start gap-3">
              <img
                src={thumbnailPreview}
                alt="Thumbnail preview"
                className="h-24 w-24 rounded border border-(--color-border) object-cover"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1 text-xs hover:bg-(--color-surface-muted)"
              >
                Remove
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {validationError ? (
        <p className="text-sm text-red-600" role="alert">
          {validationError}
        </p>
      ) : null}
      {createMutation.isError ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-600" role="alert">
          {(() => {
            const err = createMutation.error;
            if (err && typeof err === "object" && "response" in err) {
              const axiosError = err as { response?: { data?: { error?: { message?: string; details?: Array<{ message: string; path?: (string | number)[] }> } } } };
              const serverError = axiosError.response?.data?.error;
              if (serverError?.details && serverError.details.length > 0) {
                return (
                  <div>
                    <p className="font-medium">{serverError.message}</p>
                    <ul className="mt-1 list-disc pl-5">
                      {serverError.details.map((detail, i) => (
                        <li key={i}>{detail.path?.join(".") ? `${detail.path.join(".")}: ` : ""}{detail.message}</li>
                      ))}
                    </ul>
                  </div>
                );
              }
              if (serverError?.message) return serverError.message;
            }
            return "Could not create build. Please try again.";
          })()}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={createMutation.isPending}
        className="rounded bg-(--color-primary) px-4 py-2 text-white hover:bg-(--color-primary-active) disabled:opacity-50"
      >
        {createMutation.isPending ? "Saving…" : "Create"}
      </button>
      <PublishStatusModal
        isOpen={showPublishModal}
        assetType="build"
        onConfirm={handlePublishChoice}
        onClose={() => {
          setShowPublishModal(false);
          setPendingFormData(null);
        }}
      />
      <DuplicateWarningModal
        isOpen={showDuplicateModal}
        assetType="build"
        duplicates={duplicateMatches}
        onClose={() => {
          setShowDuplicateModal(false);
          setDuplicateMatches([]);
        }}
      />
    </form>
  );
}
