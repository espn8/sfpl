/** Allowed archive suffixes for direct skill package downloads. */
export const ARCHIVE_EXTENSIONS = [".zip", ".tar", ".tar.gz", ".tgz", ".tar.bz2", ".7z", ".rar"] as const;

/** Slack skill doc pages in the Salesforce enterprise workspace must use this URL prefix. */
export const SLACK_ENTERPRISE_SKILL_DOCS_URL_PREFIX = "https://salesforce.enterprise.slack.com/docs/";

export function isValidArchiveUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    return ARCHIVE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

export function isValidSlackEnterpriseSkillUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed.startsWith(SLACK_ENTERPRISE_SKILL_DOCS_URL_PREFIX)) {
    return false;
  }
  if (trimmed.toLowerCase().includes("archive")) {
    return false;
  }
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

/** Skill URL: compressed package link or Salesforce enterprise Slack skill docs URL. */
export function isValidSkillPackageUrl(url: string): boolean {
  return isValidArchiveUrl(url) || isValidSlackEnterpriseSkillUrl(url);
}
