import { shareOrCopyLink } from "../../lib/shareOrCopyLink";

export async function shareOrCopyPromptLink(title: string, url: string): Promise<void> {
  await shareOrCopyLink(title, url);
}
