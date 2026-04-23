import { useEffect, useState } from "react";

const STORAGE_KEY = "promptlibrary.compliance.acknowledged";
const HOURS_96_MS = 96 * 60 * 60 * 1000;

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ComplianceModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const lastAcknowledged = localStorage.getItem(STORAGE_KEY);
    if (lastAcknowledged) {
      const timestamp = parseInt(lastAcknowledged, 10);
      const now = Date.now();
      if (now - timestamp < HOURS_96_MS) {
        return;
      }
    }
    setIsOpen(true);
  }, []);

  const handleAcknowledge = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setIsOpen(false);
  };

  const handleExit = () => {
    window.location.href = "https://www.salesforce.com";
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 p-4">
      <div
        className="w-full max-w-lg rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="compliance-modal-title"
        aria-describedby="compliance-modal-description"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <ShieldIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 id="compliance-modal-title" className="text-lg font-semibold text-(--color-text)">
            Important Compliance Notice
          </h2>
        </div>

        <div id="compliance-modal-description" className="mb-6 space-y-4">
          <p className="text-sm text-(--color-text)">
            All users are required to utilize only authorized software, hardware, and third-party tools approved by the{" "}
            <a
              href="https://basecamp.salesforce.com/content/orgesc-external-sam-policy---rules-and-guidelines"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-(--color-primary) underline hover:no-underline"
            >
              Salesforce SAM Team
            </a>
            .
          </p>
          <p className="text-sm text-(--color-text)">
            Usage must strictly adhere to established protocols and be conducted in a manner consistent with the{" "}
            <a
              href="https://basecamp.salesforce.com/content/techforce-data-classification"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-(--color-primary) underline hover:no-underline"
            >
              Salesforce Data Classification Policy
            </a>
            .
          </p>
          <p className="text-sm text-(--color-text)">
            It is the responsibility of every user to ensure that sensitive or restricted data is handled, stored, and
            transmitted only through the specific channels designated for its classification level.
          </p>
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Unauthorized use of non-approved tools or improper handling of data may result in disciplinary action.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="order-2 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm font-medium text-(--color-text) hover:bg-(--color-surface-muted) sm:order-1"
            onClick={handleExit}
          >
            Nope, get me out of here
          </button>
          <button
            type="button"
            className="order-1 rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-medium text-(--color-text-inverse) hover:bg-(--color-primary-active) sm:order-2"
            onClick={handleAcknowledge}
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
