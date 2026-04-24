/**
 * Resend slackbot-skill digest emails for a specific list of creators.
 *
 * Useful when a subset of digest emails failed during the original import (e.g.
 * Mailgun hourly rate-limit). Recipients receive the identical digest template
 * the importer would have sent: a list of all Skills they own in the prod DB
 * that are tagged `slackbot`, with a welcome paragraph if they're still a
 * first-timer (User.googleSub is null).
 *
 * Usage:
 *   # Dry run: show who would be emailed and what they'd get; no sends.
 *   RESEND_EMAILS="a@x.com,b@y.com" \
 *     tsx server/scripts/resendSlackbotDigests.ts
 *
 *   # Send for real:
 *   DATABASE_URL="$(heroku config:get DATABASE_URL -a aosfail)" \
 *     SMTP_HOST="$(heroku config:get SMTP_HOST -a aosfail)" \
 *     SMTP_PORT="$(heroku config:get SMTP_PORT -a aosfail)" \
 *     SMTP_USER="$(heroku config:get SMTP_USER -a aosfail)" \
 *     SMTP_PASS="$(heroku config:get SMTP_PASS -a aosfail)" \
 *     SMTP_FROM="$(heroku config:get SMTP_FROM -a aosfail)" \
 *     APP_BASE_URL="$(heroku config:get APP_BASE_URL -a aosfail)" \
 *     # (other env vars config/env.ts requires...) \
 *     RESEND_EMAILS="rbhowmick@salesforce.com,rserozi@salesforce.com" \
 *     tsx server/scripts/resendSlackbotDigests.ts --send
 */
import { PrismaClient } from "@prisma/client";
import { isEmailConfigured } from "../src/lib/email";
import { BatchMailer } from "../src/lib/batchMailer";
import {
  buildDigest,
  type CreatedSkillForEmail,
} from "./_slackbotDigest";

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const SEND = process.argv.includes("--send");

function parseEmails(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

async function main() {
  const emails = parseEmails(process.env.RESEND_EMAILS);
  if (emails.length === 0) {
    throw new Error(
      "RESEND_EMAILS env var is required. Example: RESEND_EMAILS='a@x.com,b@y.com'"
    );
  }

  const mode = SEND ? "SEND" : "DRY-RUN";
  console.log(`${mode} mode — ${emails.length} recipient(s): ${emails.join(", ")}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? "<set>" : "<missing!>"}`);
  console.log(`SMTP configured: ${isEmailConfigured() ? "yes" : "NO"}`);

  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: {
      id: true,
      email: true,
      name: true,
      googleSub: true,
      skills: {
        where: { tools: { has: "slackbot" } },
        orderBy: { id: "asc" },
        select: {
          id: true,
          title: true,
          summary: true,
          skillUrl: true,
        },
      },
    },
  });

  const foundEmails = new Set(users.map((u) => u.email));
  const missing = emails.filter((e) => !foundEmails.has(e));
  if (missing.length > 0) {
    console.warn(`\nWARN: no User record for: ${missing.join(", ")}`);
  }

  const toSend = users.filter((u) => u.skills.length > 0);
  const skipped = users.length - toSend.length;
  for (const u of users) {
    if (u.skills.length === 0) {
      console.log(`  SKIP ${u.email} — no slackbot skills owned`);
    }
  }

  if (!SEND) {
    for (const user of toSend) {
      const digest = buildDigest(
        { email: user.email, name: user.name, isFirstTimer: !user.googleSub },
        user.skills.map((s) => ({
          id: s.id,
          title: s.title,
          summary: s.summary ?? "",
          skillUrl: s.skillUrl,
        }))
      );
      console.log(
        `  WOULD SEND to ${user.email} (${user.skills.length} skill${user.skills.length === 1 ? "" : "s"}, ${user.googleSub ? "returning" : "first-timer"}): "${digest.subject}"`
      );
    }
    console.log(
      `\nWould send: ${toSend.length}, skipped: ${skipped}. Re-run with --send to actually email.`
    );
    return;
  }

  if (!isEmailConfigured()) {
    throw new Error("SMTP not configured; aborting. Set SMTP_* env vars.");
  }

  const mailer = new BatchMailer({
    total: toSend.length,
    onSend: ({ index, total, label, result, sentInWindow }) => {
      const prefix = `  [${index}${total ? `/${total}` : ""}]`;
      if (result.success) {
        console.log(`${prefix} OK   ${label} — ${sentInWindow}/hour window`);
      } else {
        console.error(`${prefix} FAIL ${label}: ${result.error}`);
      }
    },
  });
  mailer.logPlan(toSend.length, "digest email(s)");

  for (const user of toSend) {
    const skills: CreatedSkillForEmail[] = user.skills.map((s) => ({
      id: s.id,
      title: s.title,
      summary: s.summary ?? "",
      skillUrl: s.skillUrl,
    }));
    const digest = buildDigest(
      { email: user.email, name: user.name, isFirstTimer: !user.googleSub },
      skills
    );
    await mailer.send(
      {
        to: user.email,
        subject: digest.subject,
        preheader: digest.preheader,
        html: digest.html,
        text: digest.text,
      },
      user.email
    );
  }

  const { sent, failed } = mailer.summary();
  console.log(`\nSent: ${sent}, failed: ${failed}, skipped: ${skipped}.`);
}

main()
  .catch((err) => {
    console.error("Resend failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
