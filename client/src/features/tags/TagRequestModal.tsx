import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchMe } from "../auth/api";
import { submitTagRequest } from "./api";

type TagRequestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

function parseNameParts(fullName: string | null): { firstName: string; lastName: string } {
  if (!fullName) {
    return { firstName: "", lastName: "" };
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function TagRequestModal({ isOpen, onClose, onSuccess }: TagRequestModalProps) {
  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe });
  const nameParts = parseNameParts(meQuery.data?.name ?? null);

  const [requestedName, setRequestedName] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: submitTagRequest,
    onSuccess: () => {
      setSubmitted(true);
      onSuccess?.();
    },
  });

  function handleClose() {
    setRequestedName("");
    setDescription("");
    setValidationError(null);
    setSubmitted(false);
    onClose();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(null);

    if (!requestedName.trim()) {
      setValidationError("Tag name is required.");
      return;
    }

    submitMutation.mutate({
      requestedName: requestedName.trim(),
      description: description.trim() || undefined,
      submitterFirstName: nameParts.firstName,
      submitterLastName: nameParts.lastName,
    });
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-lg">
        <h2 className="text-xl font-semibold">Request a new tag</h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Tags describe how assets are meant to be used (audience, flags, or short facets). An admin will review your
          request.
        </p>

        {submitted ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-(--color-text)">Thanks — your request was submitted.</p>
            <button
              type="button"
              onClick={handleClose}
              className="rounded bg-(--color-primary) px-4 py-2 text-sm text-(--color-text-inverse) hover:bg-(--color-primary-active)"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Tag name</span>
              <input
                type="text"
                value={requestedName}
                onChange={(e) => setRequestedName(e.target.value)}
                placeholder="e.g. internal-only, sales-enablement"
                className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                maxLength={120}
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Why is this tag useful? (optional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                maxLength={2000}
              />
            </label>

            {validationError ? <p className="text-sm text-red-600">{validationError}</p> : null}
            {submitMutation.isError ? (
              <p className="text-sm text-red-600">Could not submit. You may have a duplicate pending request or tag.</p>
            ) : null}

            <div className="flex justify-end gap-2 border-t border-(--color-border) pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="rounded border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm hover:bg-(--color-surface-muted)"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitMutation.isPending}
                className="rounded bg-(--color-primary) px-4 py-2 text-sm text-(--color-text-inverse) hover:bg-(--color-primary-active) disabled:opacity-60"
              >
                {submitMutation.isPending ? "Submitting…" : "Submit request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
