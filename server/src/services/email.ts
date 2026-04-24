import type { ToolRequest } from "@prisma/client";
import { env } from "../config/env";
import { sendBrandedEmail, escapeHtml, type SendEmailResult } from "../lib/email";

type ToolRequestNotificationData = Pick<
  ToolRequest,
  | "name"
  | "salesforceApproved"
  | "detailsUrl"
  | "description"
  | "submitterFirstName"
  | "submitterLastName"
  | "submitterEmail"
  | "createdAt"
>;

const ROW_LABEL_STYLE =
  "padding:10px 12px;border-bottom:1px solid #d7dfea;font-weight:600;color:#032d60;vertical-align:top;width:180px;";
const ROW_VALUE_STYLE =
  "padding:10px 12px;border-bottom:1px solid #d7dfea;color:#032d60;vertical-align:top;word-break:break-word;";
const SECTION_HEADING_STYLE =
  "margin:24px 0 8px 0;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#51678d;";
const TABLE_STYLE =
  "border-collapse:collapse;width:100%;border:1px solid #d7dfea;border-radius:6px;overflow:hidden;";
const LINK_STYLE = "color:#0176d3;text-decoration:underline;";
const HEADING_STYLE =
  "margin:0 0 8px 0;font-size:22px;line-height:28px;font-weight:700;color:#032d60;";
const LEAD_STYLE = "margin:0 0 16px 0;font-size:15px;line-height:22px;color:#032d60;";

export async function sendToolRequestNotification(
  request: ToolRequestNotificationData,
): Promise<SendEmailResult> {
  const formattedDate = request.createdAt.toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const adminUrl = `${env.appBaseUrl.replace(/\/+$/, "")}/admin/tool-requests`;
  const submitterName = `${request.submitterFirstName} ${request.submitterLastName}`.trim();

  const htmlBody = `
    <h1 class="email-h1" style="${HEADING_STYLE}">New Tool Submission</h1>
    <p style="${LEAD_STYLE}">A new tool has been submitted for review in the ${escapeHtml("AI Library")}.</p>

    <h2 style="${SECTION_HEADING_STYLE}">Submission Details</h2>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="${TABLE_STYLE}">
      <tr>
        <td style="${ROW_LABEL_STYLE}">Tool Name</td>
        <td style="${ROW_VALUE_STYLE}">${escapeHtml(request.name)}</td>
      </tr>
      <tr>
        <td style="${ROW_LABEL_STYLE}">Salesforce Approved</td>
        <td style="${ROW_VALUE_STYLE}">${request.salesforceApproved ? "Yes" : "No"}</td>
      </tr>
      <tr>
        <td style="${ROW_LABEL_STYLE}">Tool Details URL</td>
        <td style="${ROW_VALUE_STYLE}"><a href="${escapeHtml(request.detailsUrl)}" style="${LINK_STYLE}">${escapeHtml(request.detailsUrl)}</a></td>
      </tr>
      <tr>
        <td style="${ROW_LABEL_STYLE}">Description</td>
        <td style="${ROW_VALUE_STYLE}">${escapeHtml(request.description)}</td>
      </tr>
    </table>

    <h2 style="${SECTION_HEADING_STYLE}">Submitter Information</h2>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="${TABLE_STYLE}">
      <tr>
        <td style="${ROW_LABEL_STYLE}">Name</td>
        <td style="${ROW_VALUE_STYLE}">${escapeHtml(submitterName)}</td>
      </tr>
      <tr>
        <td style="${ROW_LABEL_STYLE}">Email</td>
        <td style="${ROW_VALUE_STYLE}"><a href="mailto:${escapeHtml(request.submitterEmail)}" style="${LINK_STYLE}">${escapeHtml(request.submitterEmail)}</a></td>
      </tr>
      <tr>
        <td style="${ROW_LABEL_STYLE}">Submitted At</td>
        <td style="${ROW_VALUE_STYLE}">${escapeHtml(formattedDate)}</td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 4px 0;">
      <tr>
        <td align="center" bgcolor="#2e844a" style="border-radius:999px;">
          <a href="${escapeHtml(adminUrl)}" class="email-button" style="background-color:#2e844a;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 24px;display:inline-block;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;">
            Review in Admin Panel
          </a>
        </td>
      </tr>
    </table>
  `;

  const textBody = `New Tool Submission

A new tool has been submitted for review.

SUBMISSION DETAILS
------------------
Tool Name: ${request.name}
Salesforce Approved: ${request.salesforceApproved ? "Yes" : "No"}
Tool Details URL: ${request.detailsUrl}
Description: ${request.description}

SUBMITTER INFORMATION
---------------------
Name: ${submitterName}
Email: ${request.submitterEmail}
Submitted At: ${formattedDate}

Review at: ${adminUrl}`;

  return sendBrandedEmail({
    to: env.toolRequestNotifyEmail,
    subject: "New Tool Submission [AI Library]",
    preheader: `New tool submitted: ${request.name} — review in the admin panel.`,
    html: htmlBody.trim(),
    text: textBody,
  });
}
