/**
 * Shared helpers for the slackbot-skills email digest.
 *
 * Used by:
 * - server/scripts/importSlackbotSkills.ts
 * - server/scripts/resendSlackbotDigests.ts
 */
import { escapeHtml } from "../src/lib/email";
import { env } from "../src/config/env";

export type CreatedSkillForEmail = {
  id: number;
  title: string;
  summary: string;
  skillUrl: string;
};

export type UserForEmail = {
  email: string;
  name: string | null;
  isFirstTimer: boolean;
};

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildDigest(
  user: UserForEmail,
  skills: CreatedSkillForEmail[]
) {
  const baseUrl = env.appBaseUrl.replace(/\/+$/, "");
  const firstName = (user.name ?? nameFromEmail(user.email)).split(/\s+/)[0];
  const countWord = skills.length === 1 ? "contribution is" : "contributions are";

  const subject = user.isFirstTimer
    ? `Welcome to the AI Library — your ${countWord} live`
    : `Your ${countWord} now in the AI Library`;

  const preheader = `We've added ${skills.length} of your skill${
    skills.length === 1 ? "" : "s"
  } to the AI Library at ${baseUrl}.`;

  const skillRowsHtml = skills
    .map((s) => {
      const link = `${baseUrl}/skills/${s.id}`;
      const summary = s.summary
        ? `<div style="margin-top:4px;color:#51678d;font-size:14px;line-height:20px;">${escapeHtml(s.summary)}</div>`
        : "";
      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #e1e5ef;">
            <a href="${escapeHtml(link)}" style="color:#0176d3;text-decoration:underline;font-weight:600;font-size:15px;">${escapeHtml(s.title)}</a>
            ${summary}
          </td>
        </tr>`;
    })
    .join("");

  const skillRowsText = skills
    .map((s) => {
      const link = `${baseUrl}/skills/${s.id}`;
      const line = `- ${s.title}`;
      const summary = s.summary ? `\n  ${s.summary}` : "";
      return `${line}\n  ${link}${summary}`;
    })
    .join("\n\n");

  const welcomeHtml = user.isFirstTimer
    ? `
      <h2 style="margin:28px 0 8px 0;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#51678d;">About the AI Library</h2>
      <p style="margin:0 0 12px 0;font-size:15px;line-height:22px;color:#032d60;">
        The AI Library is where Salesforce teams share and discover AI assets —
        prompts, skills, context docs, and builds. Instead of reinventing the wheel,
        you can find what others have already built, copy or adapt it, and add your
        own.
      </p>
      <p style="margin:0 0 12px 0;font-size:15px;line-height:22px;color:#032d60;">
        Sign in with your Salesforce Google account at
        <a href="${escapeHtml(baseUrl)}" style="color:#0176d3;text-decoration:underline;">${escapeHtml(baseUrl)}</a>
        to edit your contributions, browse what others are using, and make the
        Library your go-to place for AI at Salesforce.
      </p>
    `
    : "";

  const welcomeText = user.isFirstTimer
    ? `

ABOUT THE AI LIBRARY
--------------------
The AI Library is where Salesforce teams share and discover AI assets —
prompts, skills, context docs, and builds. Instead of reinventing the wheel,
you can find what others have already built, copy or adapt it, and add your own.

Sign in with your Salesforce Google account at ${baseUrl} to edit your
contributions, browse what others are using, and make the Library your go-to
place for AI at Salesforce.`
    : "";

  const html = `
    <h1 style="margin:0 0 8px 0;font-size:22px;line-height:28px;font-weight:700;color:#032d60;">Hi ${escapeHtml(firstName)},</h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:22px;color:#032d60;">
      Thanks for the hard work — your slackbot ${skills.length === 1 ? "skill is" : "skills are"} now part of the AI Library so the rest of the team can find and use ${skills.length === 1 ? "it" : "them"}.
    </p>

    <h2 style="margin:24px 0 4px 0;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#51678d;">What we added</h2>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      ${skillRowsHtml}
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 4px 0;">
      <tr>
        <td align="center" bgcolor="#0176d3" style="border-radius:999px;">
          <a href="${escapeHtml(baseUrl)}" style="background-color:#0176d3;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 24px;display:inline-block;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;">
            Open the AI Library
          </a>
        </td>
      </tr>
    </table>
    ${welcomeHtml}
  `.trim();

  const text = `Hi ${firstName},

Thanks for the hard work — your slackbot ${skills.length === 1 ? "skill is" : "skills are"} now part of the AI Library so the rest of the team can find and use ${skills.length === 1 ? "it" : "them"}.

WHAT WE ADDED
-------------
${skillRowsText}

Open the AI Library: ${baseUrl}${welcomeText}`;

  return { subject, preheader, html, text };
}
