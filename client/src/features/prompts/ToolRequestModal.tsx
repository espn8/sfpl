import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiClient } from "../../api/client";
import { fetchMe } from "../auth/api";

type ToolRequestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

type ToolRequestInput = {
  name: string;
  salesforceApproved: boolean;
  detailsUrl: string;
  description: string;
  submitterFirstName: string;
  submitterLastName: string;
};

type ToolRequest = {
  id: number;
  name: string;
  salesforceApproved: boolean;
  detailsUrl: string;
  description: string;
  submitterFirstName: string;
  submitterLastName: string;
  submitterEmail: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "ON_HOLD";
  createdAt: string;
};

async function submitToolRequest(input: ToolRequestInput): Promise<ToolRequest> {
  const response = await apiClient.post<{ data: ToolRequest }>("/api/tool-requests", input);
  return response.data.data;
}

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

export function ToolRequestModal({ isOpen, onClose, onSuccess }: ToolRequestModalProps) {
  const meQuery = useQuery({ queryKey: ["auth", "me"], queryFn: fetchMe });
  const nameParts = parseNameParts(meQuery.data?.name ?? null);

  const [name, setName] = useState("");
  const [salesforceApproved, setSalesforceApproved] = useState<boolean | null>(null);
  const [detailsUrl, setDetailsUrl] = useState("");
  const [description, setDescription] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: submitToolRequest,
    onSuccess: () => {
      setSubmitted(true);
      onSuccess?.();
    },
  });

  function handleClose() {
    setName("");
    setSalesforceApproved(null);
    setDetailsUrl("");
    setDescription("");
    setValidationError(null);
    setSubmitted(false);
    onClose();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError("Tool name is required.");
      return;
    }
    if (salesforceApproved === null) {
      setValidationError("Please select whether the tool is Salesforce approved.");
      return;
    }
    if (!detailsUrl.trim()) {
      setValidationError("Link to tool details is required.");
      return;
    }
    try {
      new URL(detailsUrl.trim());
    } catch {
      setValidationError("Please enter a valid URL for the tool details link.");
      return;
    }
    if (!description.trim()) {
      setValidationError("Tool description is required.");
      return;
    }

    submitMutation.mutate({
      name: name.trim(),
      salesforceApproved,
      detailsUrl: detailsUrl.trim(),
      description: description.trim(),
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
        {submitted ? (
          <>
            <h2 className="text-xl font-semibold">Request Submitted</h2>
            <p className="mt-2 text-sm text-(--color-text-muted)">
              Thank you for your tool request. An administrator will review it and you'll be notified once a decision
              is made.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded bg-(--color-primary) px-4 py-2 text-(--color-text-inverse) hover:bg-(--color-primary-active)"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold">Request a New Tool</h2>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              Submit a request to add a new tool to the library. All fields are required.
            </p>

            <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Tool Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter the name of the tool"
                  className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                  maxLength={100}
                />
              </label>

              <fieldset className="text-sm">
                <legend className="mb-2 font-medium">Is this tool Salesforce Approved?</legend>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="salesforceApproved"
                      checked={salesforceApproved === true}
                      onChange={() => setSalesforceApproved(true)}
                      className="h-4 w-4"
                    />
                    <span>Yes</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="salesforceApproved"
                      checked={salesforceApproved === false}
                      onChange={() => setSalesforceApproved(false)}
                      className="h-4 w-4"
                    />
                    <span>No</span>
                  </label>
                </div>
              </fieldset>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Link to Tool Details</span>
                <input
                  type="url"
                  value={detailsUrl}
                  onChange={(e) => setDetailsUrl(e.target.value)}
                  placeholder="https://example.com/tool-info"
                  className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                  maxLength={500}
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Tool Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this tool does and why it should be added..."
                  rows={4}
                  className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
                  maxLength={2000}
                />
              </label>

              {validationError ? <p className="text-sm text-red-600">{validationError}</p> : null}

              {submitMutation.isError ? (
                <p className="text-sm text-red-600">Failed to submit request. Please try again.</p>
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
                  {submitMutation.isPending ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
