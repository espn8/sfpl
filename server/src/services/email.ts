import type { ToolRequest } from "@prisma/client";
import { env } from "../config/env";
import { sendEmail, escapeHtml, type SendEmailResult } from "../lib/email";

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

export async function sendToolRequestNotification(
  request: ToolRequestNotificationData,
): Promise<SendEmailResult> {
  const formattedDate = request.createdAt.toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  });

  const htmlBody = `
    <h2>New Tool Submission</h2>
    <p>A new tool has been submitted for review in the AI Library.</p>
    
    <h3>Submission Details</h3>
    <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Tool Name</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(request.name)}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Salesforce Approved</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${request.salesforceApproved ? "Yes" : "No"}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Tool Details URL</td>
        <td style="padding: 8px; border: 1px solid #ddd;"><a href="${escapeHtml(request.detailsUrl)}">${escapeHtml(request.detailsUrl)}</a></td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Description</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(request.description)}</td>
      </tr>
    </table>
    
    <h3>Submitter Information</h3>
    <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Name</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(request.submitterFirstName)} ${escapeHtml(request.submitterLastName)}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email</td>
        <td style="padding: 8px; border: 1px solid #ddd;"><a href="mailto:${escapeHtml(request.submitterEmail)}">${escapeHtml(request.submitterEmail)}</a></td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Submitted At</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${formattedDate}</td>
      </tr>
    </table>
    
    <p style="margin-top: 20px;">
      <a href="${env.appBaseUrl}/admin/tool-requests" style="background-color: #0070d2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Review in Admin Panel</a>
    </p>
  `;

  const textBody = `
New Tool Submission [AI Library]

A new tool has been submitted for review.

SUBMISSION DETAILS
------------------
Tool Name: ${request.name}
Salesforce Approved: ${request.salesforceApproved ? "Yes" : "No"}
Tool Details URL: ${request.detailsUrl}
Description: ${request.description}

SUBMITTER INFORMATION
---------------------
Name: ${request.submitterFirstName} ${request.submitterLastName}
Email: ${request.submitterEmail}
Submitted At: ${formattedDate}

Review at: ${env.appBaseUrl}/admin/tool-requests
  `;

  return sendEmail({
    to: env.toolRequestNotifyEmail,
    subject: "New Tool Submission [AI Library]",
    text: textBody.trim(),
    html: htmlBody.trim(),
  });
}
