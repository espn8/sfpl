export type ShareResult = "shared" | "copied" | "cancelled" | "unavailable";

export async function shareOrCopyLink(title: string, url: string): Promise<ShareResult> {
  if (typeof navigator === "undefined") {
    return "unavailable";
  }

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text: title, url });
      return "shared";
    } catch (error: unknown) {
      const name = error instanceof Error ? error.name : "";
      if (name === "AbortError") {
        return "cancelled";
      }
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return "copied";
  }

  return "unavailable";
}

export function buildShareUrl(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }
  return `${window.location.origin}${path}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
