import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DuplicateWarningModal,
  isDuplicateError,
  type DuplicateMatch,
} from "../../components/DuplicateWarningModal";
import { PublishStatusModal } from "../../components/PublishStatusModal";
import { sanitizeTitle } from "../../lib/sanitizeTitle";
import { createBuild } from "./api";

type PendingBuildData = {
  title: string;
  summary?: string;
  buildUrl: string;
  supportUrl?: string;
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
};

export function BuildEditorPage() {
  const navigate = useNavigate();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<PendingBuildData | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const createMutation = useMutation({
    mutationFn: createBuild,
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
    });
    setPendingFormData(null);
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
      <input
        name="summary"
        placeholder="Summary (optional) - Brief description of what this build does"
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <select
        name="visibility"
        defaultValue="PUBLIC"
        className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      >
        <option value="PUBLIC">Public (All Users)</option>
        <option value="TEAM">Team (My OU Only)</option>
        <option value="PRIVATE">Private (Only Me)</option>
      </select>
      
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
