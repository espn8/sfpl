export async function shareOrCopyPromptLink(title: string, url: string): Promise<void> {
  if (typeof navigator === "undefined") {
    return;
  }
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text: title, url });
      return;
    } catch (error: unknown) {
      const name = error instanceof Error ? error.name : "";
      if (name === "AbortError") {
        return;
      }
    }
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
  }
}
