import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  SUMMARY_HELPER_TEXT,
  SUMMARY_MAX_CHARS,
  SUMMARY_PLACEHOLDER,
  getSummaryLengthState,
} from "./summaryGuidelines";
import { diffWords } from "./summaryDiff";
import { rewriteSummary, type AssetKindForRewrite } from "./summaryApi";

type SummaryFieldProps = {
  assetType: AssetKindForRewrite;
  defaultValue?: string;
  title?: string;
  placeholder?: string;
  inputId?: string;
  required?: boolean;
};

/**
 * Reusable summary input with live character counter, a "Tidy up with AI" button
 * (opt-in, calls /api/ai/summary-rewrite), and an inline word-level diff the user
 * can accept or reject. Renders a <input name="summary"> so surrounding forms can
 * read the value via FormData as before.
 *
 * Legacy values longer than SUMMARY_MAX_CHARS are grandfathered: the stored value
 * renders as-is, and the user can save without shortening (the server won't reject
 * an unchanged over-limit summary). The UI shows a warning prompting them to tidy.
 */
export function SummaryField({
  assetType,
  defaultValue = "",
  title,
  placeholder = SUMMARY_PLACEHOLDER,
  inputId = "summary",
  required = false,
}: SummaryFieldProps) {
  const initialValue = defaultValue ?? "";
  const [value, setValue] = useState<string>(initialValue);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  useEffect(() => {
    setValue(initialValue);
    setSuggestion(null);
    setRewriteError(null);
  }, [initialValue]);

  const length = value.length;
  const state = getSummaryLengthState(length);
  const initialWasLegacy = initialValue.length > SUMMARY_MAX_CHARS;

  const rewriteMutation = useMutation({
    mutationFn: () =>
      rewriteSummary({
        draft: value,
        title,
        assetType,
      }),
    onSuccess: (data) => {
      const clean = data.summary.trim();
      if (!clean) {
        setRewriteError("AI did not return a usable suggestion. Try again or edit it yourself.");
        return;
      }
      setSuggestion(clean);
      setRewriteError(null);
    },
    onError: (error: unknown) => {
      const message = extractErrorMessage(error);
      setRewriteError(message);
      setSuggestion(null);
    },
  });

  const diffTokens = useMemo(
    () => (suggestion !== null ? diffWords(value, suggestion) : []),
    [value, suggestion],
  );

  const handleAccept = () => {
    if (suggestion === null) return;
    setValue(suggestion);
    setSuggestion(null);
    setRewriteError(null);
  };

  const handleKeepOriginal = () => {
    setSuggestion(null);
    setRewriteError(null);
  };

  const handleTryAgain = () => {
    setSuggestion(null);
    setRewriteError(null);
    rewriteMutation.mutate();
  };

  const handleTidy = () => {
    setRewriteError(null);
    rewriteMutation.mutate();
  };

  const counterClass =
    state === "over"
      ? "text-(--color-danger) font-medium"
      : state === "warn"
        ? "text-amber-600 font-medium"
        : "text-(--color-text-muted)";

  const borderClass =
    state === "over"
      ? "border-(--color-danger)"
      : state === "warn"
        ? "border-amber-500"
        : "border-(--color-border)";

  const canTidy = value.trim().length >= 10 && !rewriteMutation.isPending;

  return (
    <div className="space-y-2">
      {initialWasLegacy ? (
        <div
          className="rounded border border-amber-500 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          role="status"
        >
          This summary is {initialValue.length} characters. New summaries must be {SUMMARY_MAX_CHARS} or fewer.
          Want AI to tidy it up?
        </div>
      ) : null}

      <div>
        <input
          id={inputId}
          name="summary"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          maxLength={SUMMARY_MAX_CHARS}
          required={required}
          aria-describedby={`${inputId}-helper`}
          aria-invalid={state === "over"}
          className={`w-full rounded border ${borderClass} bg-(--color-surface-muted) px-3 py-2`}
        />
        <div
          id={`${inputId}-helper`}
          className="mt-1 flex items-center justify-between gap-3 text-xs"
        >
          <span className="text-(--color-text-muted)">{SUMMARY_HELPER_TEXT}</span>
          <span className={counterClass} aria-live="polite">
            {length} / {SUMMARY_MAX_CHARS} characters
          </span>
        </div>
      </div>

      {state === "over" ? (
        <p className="text-xs text-(--color-danger)" role="alert">
          This summary is over the {SUMMARY_MAX_CHARS} character limit.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleTidy}
          disabled={!canTidy}
          title={`Rewrite your summary as one sentence, max ${SUMMARY_MAX_CHARS} characters.`}
          className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1 text-xs font-medium hover:bg-(--color-surface-muted) disabled:cursor-not-allowed disabled:opacity-50"
        >
          {rewriteMutation.isPending ? "Tidying…" : "Tidy up with AI"}
        </button>
        {rewriteError ? (
          <span className="text-xs text-(--color-danger)" role="alert">
            {rewriteError}
          </span>
        ) : null}
      </div>

      {suggestion !== null ? (
        <div className="space-y-3 rounded border border-(--color-border) bg-(--color-surface-muted) p-3">
          <p className="text-xs font-semibold text-(--color-text)">AI suggestion</p>

          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-(--color-text-muted)">Original</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-snug">
                {diffTokens
                  .filter((token) => token.op !== "add")
                  .map((token, index) =>
                    token.op === "remove" ? (
                      <span
                        key={index}
                        className="bg-red-100 text-red-900 line-through dark:bg-red-900/40 dark:text-red-200"
                      >
                        {token.text}
                      </span>
                    ) : (
                      <span key={index}>{token.text}</span>
                    ),
                  )}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-(--color-text-muted)">Suggestion</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-snug">
                {diffTokens
                  .filter((token) => token.op !== "remove")
                  .map((token, index) =>
                    token.op === "add" ? (
                      <span
                        key={index}
                        className="bg-green-100 font-medium text-green-900 dark:bg-green-900/40 dark:text-green-200"
                      >
                        {token.text}
                      </span>
                    ) : (
                      <span key={index}>{token.text}</span>
                    ),
                  )}
              </p>
              <p className="mt-1 text-xs text-(--color-text-muted)">
                {suggestion.length} / {SUMMARY_MAX_CHARS} characters
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAccept}
              className="rounded bg-(--color-primary) px-3 py-1 text-xs font-semibold text-(--color-text-inverse) hover:bg-(--color-primary-hover)"
            >
              Use suggestion
            </button>
            <button
              type="button"
              onClick={handleKeepOriginal}
              className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1 text-xs font-medium hover:bg-(--color-surface-muted)"
            >
              Keep original
            </button>
            <button
              type="button"
              onClick={handleTryAgain}
              disabled={rewriteMutation.isPending}
              className="rounded border border-(--color-border) bg-(--color-surface) px-3 py-1 text-xs font-medium hover:bg-(--color-surface-muted) disabled:opacity-50"
            >
              {rewriteMutation.isPending ? "Trying…" : "Try again"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function extractErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const axiosError = error as {
      response?: { data?: { error?: { message?: string } } };
    };
    const message = axiosError.response?.data?.error?.message;
    if (message) return message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Couldn't get an AI suggestion. Please try again.";
}
