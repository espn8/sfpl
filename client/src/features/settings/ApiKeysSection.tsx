import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApiKeys, createApiKey, revokeApiKey, type ApiKey, type ApiKeyWithFullKey } from "./apiKeysApi";

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="3,6 5,6 21,6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function CreateKeyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (key: ApiKeyWithFullKey) => void;
}) {
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createApiKey(name, expiresInDays ? parseInt(expiresInDays, 10) : undefined),
    onSuccess: (newKey) => {
      onCreated(newKey);
    },
    onError: () => {
      setError("Failed to create API key. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setError(null);
    createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold">Generate New API Key</h3>
        <form onSubmit={handleSubmit}>
          <label className="mb-4 block text-sm">
            <span className="mb-1 block font-medium">Key Name</span>
            <input
              type="text"
              className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
              placeholder="e.g., Cursor MCP, CLI Tool"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>
          <label className="mb-4 block text-sm">
            <span className="mb-1 block font-medium">Expires In (optional)</span>
            <select
              className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
            >
              <option value="">Never expires</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
            </select>
          </label>
          {error && (
            <div className="mb-4 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-(--color-border) bg-(--color-surface-muted) px-4 py-2 text-sm hover:bg-(--color-surface)"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded bg-(--color-primary) px-4 py-2 text-sm font-medium text-(--color-text-inverse) hover:bg-(--color-primary-active) disabled:opacity-60"
            >
              {createMutation.isPending ? "Creating..." : "Create Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewKeyModal({
  apiKey,
  onClose,
}: {
  apiKey: ApiKeyWithFullKey;
  onClose: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(apiKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-semibold">API Key Created</h3>
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          Make sure to copy your API key now. You won't be able to see it again!
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium">Your API Key</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={isVisible ? "text" : "password"}
                readOnly
                value={apiKey.key}
                className="w-full rounded border border-(--color-border) bg-(--color-surface-muted) px-3 py-2 pr-20 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setIsVisible(!isVisible)}
                className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-(--color-text-muted) hover:text-(--color-text)"
                title={isVisible ? "Hide" : "Show"}
              >
                {isVisible ? (
                  <EyeOffIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-(--color-text-muted) hover:text-(--color-text)"
                title="Copy to clipboard"
              >
                {copied ? (
                  <CheckIcon className="h-4 w-4 text-green-600" />
                ) : (
                  <CopyIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="mb-4 text-sm text-(--color-text-muted)">
          <p><strong>Name:</strong> {apiKey.name}</p>
          <p><strong>Expires:</strong> {apiKey.expiresAt ? formatDate(apiKey.expiresAt) : "Never"}</p>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-(--color-primary) px-4 py-2 text-sm font-medium text-(--color-text-inverse) hover:bg-(--color-primary-active)"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ApiKeyRow({
  apiKey,
  onRevoke,
}: {
  apiKey: ApiKey;
  onRevoke: (id: number) => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="flex items-center justify-between rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{apiKey.name}</span>
          <code className="rounded bg-(--color-surface) px-2 py-0.5 text-xs text-(--color-text-muted)">
            {apiKey.keyPrefix}...
          </code>
        </div>
        <div className="mt-1 text-xs text-(--color-text-muted)">
          Created {formatDate(apiKey.createdAt)}
          {apiKey.lastUsedAt && <span> · Last used {formatDate(apiKey.lastUsedAt)}</span>}
          {apiKey.expiresAt && <span> · Expires {formatDate(apiKey.expiresAt)}</span>}
        </div>
      </div>
      <div className="ml-4">
        {showConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-(--color-text-muted)">Revoke?</span>
            <button
              type="button"
              onClick={() => onRevoke(apiKey.id)}
              className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              className="rounded border border-(--color-border) bg-(--color-surface) px-2 py-1 text-xs hover:bg-(--color-surface-muted)"
            >
              No
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="rounded p-2 text-(--color-text-muted) hover:bg-(--color-surface) hover:text-red-600"
            title="Revoke key"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ApiKeysSection() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<ApiKeyWithFullKey | null>(null);

  const keysQuery = useQuery({
    queryKey: ["apiKeys"],
    queryFn: fetchApiKeys,
  });

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
    },
  });

  const handleCreated = (key: ApiKeyWithFullKey) => {
    setShowCreateModal(false);
    setNewlyCreatedKey(key);
    queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
  };

  return (
    <section className="rounded-lg border border-(--color-border) bg-(--color-surface) p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">API Keys</h2>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Manage API keys for programmatic access to the AI Library.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded bg-(--color-primary) px-3 py-2 text-sm font-medium text-(--color-text-inverse) hover:bg-(--color-primary-active)"
        >
          <KeyIcon className="h-4 w-4" />
          Generate Key
        </button>
      </div>

      {keysQuery.isLoading && (
        <p className="text-sm text-(--color-text-muted)">Loading API keys...</p>
      )}

      {keysQuery.data && keysQuery.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-(--color-border) bg-(--color-surface-muted) px-4 py-8 text-center">
          <KeyIcon className="mx-auto mb-2 h-8 w-8 text-(--color-text-muted)" />
          <p className="text-sm text-(--color-text-muted)">
            No API keys yet. Generate one to get started.
          </p>
        </div>
      )}

      {keysQuery.data && keysQuery.data.length > 0 && (
        <div className="space-y-2">
          {keysQuery.data.map((key) => (
            <ApiKeyRow
              key={key.id}
              apiKey={key}
              onRevoke={(id) => revokeMutation.mutate(id)}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateKeyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      )}

      {newlyCreatedKey && (
        <NewKeyModal
          apiKey={newlyCreatedKey}
          onClose={() => setNewlyCreatedKey(null)}
        />
      )}
    </section>
  );
}
