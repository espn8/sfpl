import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "../../app/providers/ToastProvider";
import { runGovernanceSweep } from "./api";

export function GovernancePage() {
  const { showToast } = useToast();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const runMutation = useMutation({
    mutationFn: (dryRun: boolean) => runGovernanceSweep(dryRun),
    onSuccess: (data) => {
      setResult(data);
      showToast("Governance sweep completed", "success");
    },
    onError: () => {
      showToast("Governance sweep failed", "error");
    },
  });

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Asset Governance</h1>
        <p className="text-sm text-(--color-text-muted)">
          Manually trigger the governance sweep: 7-day verification warnings, auto-archive of
          unverified/inactive/low-rated assets, and Smart Pick recomputation. A dry run shows what
          would change without making updates.
        </p>
      </header>

      <section className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={runMutation.isPending}
            className="inline-flex items-center rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm font-semibold text-(--color-text) hover:bg-(--color-surface-muted) disabled:opacity-60"
            onClick={() => runMutation.mutate(true)}
          >
            {runMutation.isPending ? "Running…" : "Dry run"}
          </button>
          <button
            type="button"
            disabled={runMutation.isPending}
            className="inline-flex items-center rounded-md bg-(--color-primary) px-3 py-1.5 text-sm font-semibold text-(--color-text-inverse) disabled:opacity-60"
            onClick={() => {
              if (!confirm("Run the governance sweep against production data?")) return;
              runMutation.mutate(false);
            }}
          >
            {runMutation.isPending ? "Running…" : "Run sweep"}
          </button>
        </div>
      </section>

      {result ? (
        <section className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-(--color-text-muted)">
            Result
          </h2>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-(--color-text)">
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
