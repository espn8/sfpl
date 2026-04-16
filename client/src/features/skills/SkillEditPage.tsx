import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { VariableEditor, type VariableRow } from "../../components/VariableEditor";
import { sanitizeTitle } from "../../lib/sanitizeTitle";
import { ToolRequestModal } from "../prompts/ToolRequestModal";
import {
  getSkill,
  getSkillToolsSortedAlphabetically,
  getSkillToolLabel,
  replaceSkillVariables,
  updateSkill,
} from "./api";

export function SkillEditPage() {
  const params = useParams();
  const skillId = Number(params.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [otherToolName, setOtherToolName] = useState("");
  const [showToolRequestModal, setShowToolRequestModal] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [variableRows, setVariableRows] = useState<VariableRow[]>([]);
  const [bodyText, setBodyText] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (key: string) => {
    const textarea = bodyRef.current;
    if (!textarea) return;

    const placeholder = `[${key}]`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const newText = bodyText.slice(0, start) + placeholder + bodyText.slice(end);
    setBodyText(newText);

    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + placeholder.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const skillQuery = useQuery({
    queryKey: ["skill", skillId],
    queryFn: () => getSkill(skillId),
    enabled: Number.isInteger(skillId) && skillId > 0,
  });

  useEffect(() => {
    if (skillQuery.data) {
      setSelectedTools(new Set(skillQuery.data.tools || []));
      setBodyText(skillQuery.data.body);
      setVariableRows(
        (skillQuery.data.variables ?? []).map((v) => ({
          clientId: `existing-${v.id}`,
          key: v.key,
          label: v.label ?? "",
          defaultValue: v.defaultValue ?? "",
          required: v.required,
        })),
      );
    }
  }, [skillQuery.data?.id]);

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateSkill>[1]) => updateSkill(skillId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["skill", skillId] });
      void queryClient.invalidateQueries({ queryKey: ["skills"] });
      navigate(`/skills/${skillId}`);
    },
  });

  if (!Number.isInteger(skillId) || skillId <= 0) {
    return <p className="text-sm text-(--color-text-muted)">Invalid skill.</p>;
  }

  if (skillQuery.isLoading || !skillQuery.data) {
    return <p className="text-sm text-(--color-text-muted)">Loading…</p>;
  }

  if (skillQuery.isError) {
    return <p className="text-sm text-red-600">Could not load skill.</p>;
  }

  const skill = skillQuery.data;

  return (
    <form
      className="space-y-3 rounded border border-(--color-border) bg-(--color-surface) p-4"
      key={skill.updatedAt}
      onSubmit={async (event) => {
        event.preventDefault();
        setValidationError(null);
        const formData = new FormData(event.currentTarget);
        const title = sanitizeTitle(String(formData.get("title") ?? ""));
        const summary = String(formData.get("summary") ?? "").trim();
        const body = bodyText.trim();
        const status = String(formData.get("status") ?? skill.status) as typeof skill.status;
        const visibility = String(formData.get("visibility") ?? skill.visibility) as typeof skill.visibility;
        const toolsArray = Array.from(selectedTools);
        if (!title || !body) {
          setValidationError("Title and body are required.");
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
        const variables = variableRows
          .map((row) => ({
            key: row.key.trim(),
            label: row.label.trim() || null,
            defaultValue: row.defaultValue,
            required: row.required,
          }))
          .filter((row) => row.key.length > 0);
        await replaceSkillVariables(skillId, variables);
        updateMutation.mutate({
          title,
          summary: summary || undefined,
          body,
          status,
          visibility,
          tools: toolsArray,
        });
      }}
    >
      <h2 className="text-2xl font-semibold">Edit skill</h2>
      <input
        name="title"
        defaultValue={skill.title}
        required
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <input
        name="summary"
        defaultValue={skill.summary ?? ""}
        placeholder="Summary (optional)"
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
      />
      <div className="grid gap-2 md:grid-cols-2">
        <select
          name="status"
          defaultValue={skill.status}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          name="visibility"
          defaultValue={skill.visibility}
          className="rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
        >
          <option value="PUBLIC">Public (All Users)</option>
          <option value="TEAM">Team (My OU Only)</option>
          <option value="PRIVATE">Private (Only Me)</option>
        </select>
      </div>
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
      <textarea
        ref={bodyRef}
        name="body"
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        placeholder="Write your skill instructions here. Use [VARIABLE] or {{VARIABLE}} for customizable fields."
        rows={16}
        className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 font-mono text-sm"
      />
      <VariableEditor variables={variableRows} onChange={setVariableRows} onInsert={insertVariable} />
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
