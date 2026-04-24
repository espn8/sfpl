import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../app/providers/ToastProvider";
import type { AssetType, ArchiveReason } from "./api";
import {
  archiveReasonLabel,
  formatDaysAgo,
  formatDaysUntil,
  getVerificationState,
  unarchiveAssetApi,
  verifyAssetApi,
} from "./governance";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type VerificationChipProps = {
  status: Status;
  lastVerifiedAt?: string | null;
  verificationDueAt?: string | null;
  archiveReason?: ArchiveReason | null;
  className?: string;
};

export function VerificationChip({
  status,
  lastVerifiedAt,
  verificationDueAt,
  archiveReason,
  className,
}: VerificationChipProps) {
  if (status === "ARCHIVED") {
    const label = archiveReasonLabel(archiveReason) ?? "Archived";
    return (
      <span
        className={`inline-flex items-center rounded-full bg-(--color-surface-muted) px-2 py-0.5 text-xs font-medium text-(--color-text-muted) ${className ?? ""}`}
        title={label}
      >
        {label}
      </span>
    );
  }
  if (status !== "PUBLISHED") return null;
  const state = getVerificationState(status, verificationDueAt);
  if (state === "none") return null;

  const verifiedAgo = formatDaysAgo(lastVerifiedAt);
  const until = formatDaysUntil(verificationDueAt);

  if (state === "overdue") {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200 ${className ?? ""}`}
        title={`Verification overdue. Last verified ${verifiedAgo ?? "never"}.`}
      >
        Verification overdue
      </span>
    );
  }
  if (state === "warning") {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 ${className ?? ""}`}
        title={`Verification due in ${until}.`}
      >
        Verify in {until}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full bg-(--color-surface-muted) px-2 py-0.5 text-xs text-(--color-text-muted) ${className ?? ""}`}
      title={`Verified ${verifiedAgo ?? "recently"}.`}
    >
      Verified {verifiedAgo ?? "recently"}
    </span>
  );
}

type VerifyButtonProps = {
  assetType: AssetType;
  assetId: number;
  status: Status;
  verificationDueAt?: string | null;
  compact?: boolean;
  onSuccess?: () => void;
};

export function VerifyAssetButton({
  assetType,
  assetId,
  status,
  verificationDueAt,
  compact = false,
  onSuccess,
}: VerifyButtonProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const mutation = useMutation({
    mutationFn: () => verifyAssetApi(assetType, assetId),
    onSuccess: async () => {
      showToast("Marked as verified for another 30 days");
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      await queryClient.invalidateQueries({ queryKey: [assetType] });
      await queryClient.invalidateQueries({ queryKey: [`${assetType}s`] });
      await queryClient.invalidateQueries({ queryKey: ["me", "needs-verification"] });
      onSuccess?.();
    },
    onError: () => {
      showToast("Couldn't verify right now");
    },
  });

  if (status !== "PUBLISHED") return null;
  const state = getVerificationState(status, verificationDueAt);
  if (state !== "overdue" && state !== "warning") return null;

  const cls = compact
    ? "inline-flex items-center rounded-md border border-(--color-border) bg-(--color-surface) px-2 py-1 text-xs font-medium text-(--color-text) hover:bg-(--color-surface-muted) disabled:opacity-60"
    : "inline-flex items-center rounded-md bg-(--color-primary) px-3 py-1.5 text-sm font-semibold text-(--color-text-inverse) shadow-sm hover:opacity-90 disabled:opacity-60";

  return (
    <button
      type="button"
      className={cls}
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? "Verifying…" : "Verify"}
    </button>
  );
}

type UnarchiveButtonProps = {
  assetType: AssetType;
  assetId: number;
  status: Status;
  compact?: boolean;
  onSuccess?: () => void;
};

export function UnarchiveAssetButton({
  assetType,
  assetId,
  status,
  compact = false,
  onSuccess,
}: UnarchiveButtonProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const mutation = useMutation({
    mutationFn: () => unarchiveAssetApi(assetType, assetId),
    onSuccess: async () => {
      showToast("Unarchived and re-verified");
      await queryClient.invalidateQueries({ queryKey: ["assets"] });
      await queryClient.invalidateQueries({ queryKey: [assetType] });
      await queryClient.invalidateQueries({ queryKey: [`${assetType}s`] });
      onSuccess?.();
    },
    onError: () => {
      showToast("Couldn't unarchive right now");
    },
  });
  if (status !== "ARCHIVED") return null;

  const cls = compact
    ? "inline-flex items-center rounded-md border border-(--color-border) bg-(--color-surface) px-2 py-1 text-xs font-medium text-(--color-text) hover:bg-(--color-surface-muted) disabled:opacity-60"
    : "inline-flex items-center rounded-md bg-(--color-primary) px-3 py-1.5 text-sm font-semibold text-(--color-text-inverse) shadow-sm hover:opacity-90 disabled:opacity-60";

  return (
    <button type="button" className={cls} disabled={mutation.isPending} onClick={() => mutation.mutate()}>
      {mutation.isPending ? "Unarchiving…" : "Unarchive"}
    </button>
  );
}

type VerificationBannerProps = {
  assetType: AssetType;
  assetId: number;
  status: Status;
  isOwner: boolean;
  lastVerifiedAt?: string | null;
  verificationDueAt?: string | null;
  archiveReason?: ArchiveReason | null;
};

export function VerificationBanner({
  assetType,
  assetId,
  status,
  isOwner,
  lastVerifiedAt,
  verificationDueAt,
  archiveReason,
}: VerificationBannerProps) {
  if (status === "ARCHIVED") {
    const label = archiveReasonLabel(archiveReason) ?? "This asset is archived";
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-(--color-border) bg-(--color-surface-muted) p-3 text-sm text-(--color-text)">
        <div>
          <p className="font-semibold">{label}</p>
          <p className="text-(--color-text-muted)">
            Archived assets are hidden from feeds and leaderboards. {isOwner ? "Unarchive to restore." : null}
          </p>
        </div>
        {isOwner ? <UnarchiveAssetButton assetType={assetType} assetId={assetId} status={status} /> : null}
      </div>
    );
  }
  if (status !== "PUBLISHED") return null;
  const state = getVerificationState(status, verificationDueAt);
  if (state === "verified" || state === "none") return null;

  const verifiedAgo = formatDaysAgo(lastVerifiedAt);
  const until = formatDaysUntil(verificationDueAt);

  const tone =
    state === "overdue"
      ? "border-red-300 bg-red-50 text-red-900 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-100"
      : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-100";

  const headline =
    state === "overdue"
      ? "Verification overdue"
      : `Please re-verify within ${until}`;

  const body =
    state === "overdue"
      ? `This asset hasn't been re-verified. Last verified ${verifiedAgo ?? "never"}. If no action is taken it will be archived.`
      : `Owners should confirm this ${assetType} is still valid every 30 days. Last verified ${verifiedAgo ?? "a while ago"}.`;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm ${tone}`}>
      <div>
        <p className="font-semibold">{headline}</p>
        <p className="opacity-90">{body}</p>
      </div>
      {isOwner ? (
        <VerifyAssetButton
          assetType={assetType}
          assetId={assetId}
          status={status}
          verificationDueAt={verificationDueAt}
        />
      ) : null}
    </div>
  );
}
