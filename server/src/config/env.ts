import dotenv from "dotenv";

dotenv.config();

type Env = {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  corsOrigin: string;
  sessionSecret: string;
  cookieSecure: boolean;
  sessionSameSite: "lax" | "strict" | "none";
  googleClientId: string;
  googleClientSecret: string;
  googleCallbackUrl: string;
  appBaseUrl: string;
  googleAllowedDomain?: string;
  nanoBananaApiKey?: string;
  /** Lowercased emails that receive ADMIN on sign-in (comma-separated in env). OWNER is never changed. */
  bootstrapAdminEmails: Set<string>;
  smtpHost?: string;
  smtpPort: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  toolRequestNotifyEmail: string;
  /** Secret token for dev/test whitelist bypass authentication (X-Dev-Whitelist-Token header). */
  devWhitelistToken?: string;
  /** User ID to impersonate when using whitelist bypass auth. Defaults to 1. */
  devWhitelistUserId: number;
  /** Gate the governance sweep (auto-archive, warning emails, Smart Pick recompute). */
  governanceSweepEnabled: boolean;
};

function getRequired(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be defined in environment variables.`);
  }

  return value;
}

function parseBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${name} must be either "true" or "false".`);
}

function parseSameSite(): "lax" | "strict" | "none" {
  const value = (process.env.SESSION_SAME_SITE ?? "lax").toLowerCase();
  if (value === "lax" || value === "strict" || value === "none") {
    return value;
  }

  throw new Error(`SESSION_SAME_SITE must be "lax", "strict", or "none".`);
}

function parseBootstrapAdminEmails(raw: string | undefined): Set<string> {
  if (!raw?.trim()) {
    return new Set();
  }

  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0),
  );
}

export const env: Env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  databaseUrl: getRequired("DATABASE_URL"),
  corsOrigin: getRequired("CORS_ORIGIN"),
  sessionSecret: getRequired("SESSION_SECRET"),
  cookieSecure: parseBoolean("COOKIE_SECURE", false),
  sessionSameSite: parseSameSite(),
  googleClientId: getRequired("GOOGLE_CLIENT_ID"),
  googleClientSecret: getRequired("GOOGLE_CLIENT_SECRET"),
  googleCallbackUrl: getRequired("GOOGLE_CALLBACK_URL"),
  appBaseUrl: getRequired("APP_BASE_URL"),
  googleAllowedDomain: process.env.GOOGLE_ALLOWED_DOMAIN,
  nanoBananaApiKey: process.env.NANO_BANANA_API_KEY,
  bootstrapAdminEmails: parseBootstrapAdminEmails(process.env.BOOTSTRAP_ADMIN_EMAILS),
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFrom: process.env.SMTP_FROM,
  toolRequestNotifyEmail: process.env.TOOL_REQUEST_NOTIFY_EMAIL ?? "akleymann+ailibrary@salesforce.com",
  devWhitelistToken: process.env.DEV_WHITELIST_TOKEN,
  devWhitelistUserId: Number(process.env.DEV_WHITELIST_USER_ID ?? 1),
  governanceSweepEnabled: parseBoolean("GOVERNANCE_SWEEP_ENABLED", false),
};
