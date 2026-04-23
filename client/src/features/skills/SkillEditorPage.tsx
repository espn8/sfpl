import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PublishStatusModal } from "../../components/PublishStatusModal";
import { sanitizeTitle } from "../../lib/sanitizeTitle";
import { ToolRequestModal } from "../prompts/ToolRequestModal";
import { createSkill, getSkillToolsSortedAlphabetically, getSkillToolLabel, isValidArchiveUrl, ARCHIVE_EXTENSIONS, type SkillTool } from "./api";

type PendingSkillData = {
  title: string;
  summary?: string;
  skillUrl: string;
  supportUrl?: string;
  visibility: "PUBLIC" | "TEAM" | "PRIVATE";
  tools: SkillTool[];
};

export function SkillEditorPage() {
  const navigate = useNavigate();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedTools, setSelectedTools] = useState<Set<SkillTool>>(new Set());
  const [otherToolName, setOtherToolName] = useState("");
  const [showToolRequestModal, setShowToolRequestModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<PendingSkillData | null>(null);

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const createMutation = useMutation({
    mutationFn: createSkill,
    onSuccess: (skill) => {
      navigate(`/skills/${skill.id}`);
    },
    onError: (error) => {
      console.error("Create skill error:", error);
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

  return (
    <form
      className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setValidationError(null);
        const formData = new FormData(event.currentTarget);
        const title = sanitizeTitle(String(formData.get("title") ?? ""));
        const summary = String(formData.get("summary") ?? "").trim();
        const skillUrl = String(formData.get("skillUrl") ?? "").trim();
        const supportUrl = String(formData.get("supportUrl") ?? "").trim();
        const visibility = String(formData.get("visibility") ?? "PUBLIC") as "PUBLIC" | "TEAM" | "PRIVATE";
        const toolsArray = Array.from(selectedTools);

        if (!title) {
          setValidationError("Title is required.");
          return;
        }
        if (!skillUrl) {
          setValidationError("Skill URL is required.");
          return;
        }
        if (!isValidUrl(skillUrl)) {
          setValidationError("Skill URL must be a valid URL.");
          return;
        }
        if (!isValidArchiveUrl(skillUrl)) {
          setValidationError(`Skill URL must link to a compressed file (${ARCHIVE_EXTENSIONS.join(", ")}).`);
          return;
        }
        if (supportUrl && !isValidUrl(supportUrl)) {
          setValidationError("Documentation URL must be a valid URL if provided.");
          return;
        }
        if (toolsArray.length === 0) {
          setValidationError("Please select at least one tool.");
          return;
        }
        if (selectedTools.has("other") && !otherToolName.trim()) {
          setValidationError("Please enter the tool name for 'Other'.");
          return;
        }
        
        setPendingFormData({
          title,
          summary: summary || undefined,
          skillUrl,
          supportUrl: supportUrl || undefined,
          visibility,
          tools: toolsArray,
        });
        setShowPublishModal(true);
      }}
    >
      <h2 className="text-2xl font-semibold">Create Skill</h2>
      <div className="rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-4">
        <p className="text-sm text-(--color-text-muted)">
          <strong>Skills</strong> are downloadable assets like plugins, extensions, or toolkits. 
          Provide a URL to a compressed file (.zip, .tar.gz, etc.) and optional documentation.
        </p>
      </div>
      <input
        name="title"
        placeholder="Skill name"
        required
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <input
        name="summary"
        placeholder="Summary (optional) - Brief description of what this skill does"
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
      <div className="space-y-2 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
        <p className="text-sm font-medium">Tools (select one or many)</p>
        <div className="grid gap-2 sm:grid-cols-4">
          {getSkillToolsSortedAlphabetically().map((tool) => (
            <label key={tool} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedTools.has(tool)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setSelectedTools((current) => {
                    const next = new Set(current);
                    if (checked) {
                      next.add(tool);
                    } else {
                      next.delete(tool);
                      if (tool === "other") {
                        setOtherToolName("");
                      }
                    }
                    return next;
                  });
                }}
              />
              <span>{getSkillToolLabel(tool)}</span>
            </label>
          ))}
        </div>
        {selectedTools.has("other") && (
          <div className="space-y-2 border-t border-(--color-border) pt-3">
            <label className="block text-sm">
              <span className="font-medium">Tool name</span>
              <input
                type="text"
                value={otherToolName}
                onChange={(event) => setOtherToolName(event.target.value)}
                placeholder="Enter the tool name"
                className="mt-1 w-full rounded border border-(--color-border) bg-(--color-surface) px-3 py-2"
              />
            </label>
            <p className="text-xs text-(--color-text-muted)">
              Don't see your tool?{" "}
              <button
                type="button"
                onClick={() => setShowToolRequestModal(true)}
                className="font-medium text-(--color-primary) underline hover:text-(--color-primary-hover)"
              >
                Request a new tool be added
              </button>
            </p>
          </div>
        )}
        <ToolRequestModal isOpen={showToolRequestModal} onClose={() => setShowToolRequestModal(false)} />
      </div>

      <div className="space-y-3 rounded border border-(--color-border) bg-(--color-surface-muted) p-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Skill URL <span className="text-red-500">*</span>
          </label>
          <input
            name="skillUrl"
            type="url"
            placeholder="https://example.com/my-skill.zip"
            required
            className="w-full rounded border border-(--color-border) bg-(--color-surface) px-3 py-2"
          />
          <p className="mt-1 text-xs text-(--color-text-muted)">
            Link to the skill package file. Must be a compressed file ({ARCHIVE_EXTENSIONS.join(", ")}).
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
            return "Could not create skill. Please try again.";
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
        assetType="skill"
        onConfirm={handlePublishChoice}
        onClose={() => {
          setShowPublishModal(false);
          setPendingFormData(null);
        }}
      />
    </form>
  );
}
