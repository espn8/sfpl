import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "../config/env";

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
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
