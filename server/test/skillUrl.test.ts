import { describe, expect, it } from "vitest";
import {
  isValidArchiveUrl,
  isValidSkillPackageUrl,
  isValidSlackEnterpriseSkillUrl,
  SLACK_ENTERPRISE_SKILLS_URL_PREFIX,
} from "../src/lib/skillUrl";

describe("skillUrl validation", () => {
  it("accepts archive URLs by extension", () => {
    expect(isValidArchiveUrl("https://cdn.example/pkg.tar.gz")).toBe(true);
    expect(isValidArchiveUrl("https://x.com/a.ZIP")).toBe(true);
  });

  it("accepts only Salesforce enterprise Slack skill prefix", () => {
    expect(isValidSlackEnterpriseSkillUrl(`${SLACK_ENTERPRISE_SKILLS_URL_PREFIX}abc`)).toBe(true);
    expect(isValidSlackEnterpriseSkillUrl(`  ${SLACK_ENTERPRISE_SKILLS_URL_PREFIX}abc  `)).toBe(true);
    expect(isValidSlackEnterpriseSkillUrl("https://salesforce.slack.com/skills/x")).toBe(false);
    expect(isValidSlackEnterpriseSkillUrl("http://salesforce.enterprise.slack.com/skills/x")).toBe(false);
  });

  it("isValidSkillPackageUrl allows archive or Slack enterprise", () => {
    expect(isValidSkillPackageUrl("https://x/skill.zip")).toBe(true);
    expect(isValidSkillPackageUrl(`${SLACK_ENTERPRISE_SKILLS_URL_PREFIX}id`)).toBe(true);
    expect(isValidSkillPackageUrl("https://example.com/doc")).toBe(false);
  });
});
