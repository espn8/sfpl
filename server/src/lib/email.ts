import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../config/env";
import { wrapEmailHtml, wrapEmailText, type BrandedEmailOptions } from "./emailTemplate";

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
};

export type SendBrandedEmailOptions = {
  to: string | string[];
  subject: string;
  /** Body HTML placed inside the branded card. Omit the outer <html>/<body>. */
  html: string;
  /** Plain-text fallback for clients that cannot render HTML. */
  text: string;
  /** Optional preview text shown after the subject in inbox listings. */
  preheader?: string;
};

export type SendEmailResult = {
  success: boolean;
  error?: string;
};

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) {
    return transporter;
  }

  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

  return transporter;
}

export function isEmailConfigured(): boolean {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const transport = getTransporter();

  if (!transport) {
    console.warn("Email skipped (SMTP not configured):", options.subject);
    return { success: false, error: "SMTP not configured" };
  }

  const from = env.smtpFrom ?? env.smtpUser;

  try {
    await transport.sendMail({
      from,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send email:", message);
    return { success: false, error: message };
  }
}

/**
 * Send an email wrapped in the shared site-branded header/footer template.
 *
 * Callers should provide only the message body (as HTML and plain text);
 * the header, footer, responsive styling, and dark-mode support are applied
 * automatically.
 */
export async function sendBrandedEmail(options: SendBrandedEmailOptions): Promise<SendEmailResult> {
  const templateOptions: BrandedEmailOptions = {
    preheader: options.preheader,
    title: options.subject,
  };

  return sendEmail({
    to: options.to,
    subject: options.subject,
    html: wrapEmailHtml(options.html, templateOptions),
    text: wrapEmailText(options.text, templateOptions),
  });
}

export async function verifyEmailConnection(): Promise<boolean> {
  const transport = getTransporter();

  if (!transport) {
    return false;
  }

  try {
    await transport.verify();
    console.log("SMTP connection verified successfully");
    return true;
  } catch (error) {
    console.error("SMTP connection verification failed:", error);
    return false;
  }
}

export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char] ?? char);
}
