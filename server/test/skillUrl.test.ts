import { describe, expect, it } from "vitest";
import {
  isValidArchiveUrl,
  isValidSkillPackageUrl,
  isValidSlackEnterpriseSkillUrl,
  SLACK_ENTERPRISE_SKILL_DOCS_URL_PREFIX,
} from "../src/lib/skillUrl";

describe("skillUrl validation", () => {
  it("accepts archive URLs by extension", () => {
    expect(isValidArchiveUrl("https://cdn.example/pkg.tar.gz")).toBe(true);
    expect(isValidArchiveUrl("https://x.com/a.ZIP")).toBe(true);
  });

  it("accepts only Salesforce enterprise Slack skill docs prefix", () => {
    expect(isValidSlackEnterpriseSkillUrl(`${SLACK_ENTERPRISE_SKILL_DOCS_URL_PREFIX}T5J4Q04QG/F0ATALD31EF`)).toBe(
      true,
    );
    expect(
      isValidSlackEnterpriseSkillUrl(`  ${SLACK_ENTERPRISE_SKILL_DOCS_URL_PREFIX}T5J4Q04QG/F0ATALD31EF  `),
    ).toBe(true);
    expect(isValidSlackEnterpriseSkillUrl("https://salesforce.slack.com/docs/x")).toBe(false);
    expect(isValidSlackEnterpriseSkillUrl("http://salesforce.enterprise.slack.com/docs/x")).toBe(false);
    expect(isValidSlackEnterpriseSkillUrl("https://salesforce.enterprise.slack.com/skills/F01234")).toBe(false);
  });

  it("rejects Slack URLs that contain archive", () => {
    expect(
      isValidSlackEnterpriseSkillUrl(
        "https://salesforce.enterprise.slack.com/docs/T024/archives/C0123/F0ABC",
      ),
    ).toBe(false);
    expect(
      isValidSlackEnterpriseSkillUrl("https://salesforce.enterprise.slack.com/docs/T024BE7LD/F0archiveX"),
    ).toBe(false);
  });

  it("isValidSkillPackageUrl allows archive or Slack enterprise docs", () => {
    expect(isValidSkillPackageUrl("https://x/skill.zip")).toBe(true);
    expect(isValidSkillPackageUrl(`${SLACK_ENTERPRISE_SKILL_DOCS_URL_PREFIX}T5J4Q04QG/F0ATALD31EF`)).toBe(true);
    expect(isValidSkillPackageUrl("https://example.com/doc")).toBe(false);
  });
});
