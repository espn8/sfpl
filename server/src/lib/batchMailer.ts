import {
  sendBrandedEmail,
  type SendBrandedEmailOptions,
  type SendEmailResult,
} from "./email";

/**
 * Mailgun recipient cap per hour on mail.mysalesforcedemo.com.
 *
 * This is a HARD LIMIT enforced by Mailgun. Exceeding it causes 429s, dropped
 * messages, and domain reputation damage. Only raise this after Mailgun has
 * approved a higher cap in the dashboard (Sending → Domains → Limits).
 */
export const MAILGUN_HOURLY_CAP = 300;

/**
 * Safety margin: leave ~10 headroom for retries, concurrent senders, and clock
 * skew between our sent timestamps and Mailgun's window.
 */
export const DEFAULT_HOURLY_SAFE_CAP = 290;

const HOUR_MS = 60 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function fmtDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export type BatchMailerOptions = {
  /** Per-window recipient cap. Defaults to 290 (300 - 10 safety margin). */
  cap?: number;
  /** Rolling window size in ms. Defaults to 1 hour. */
  windowMs?: number;
  /**
   * Evenly pace sends across the window (`windowMs / cap` between messages).
   * When true, the sender naturally stays well under the cap without ever
   * hitting the window-gate. Defaults to true.
   */
  pace?: boolean;
  /**
   * Optional per-send logger. Called after each send (success or failure).
   * Receives the 1-based index, total count (if known), and a label.
   */
  onSend?: (ctx: {
    index: number;
    total: number | null;
    label: string;
    result: SendEmailResult;
    sentInWindow: number;
  }) => void;
};

/**
 * Rolling-window rate limiter for batch email sends through
 * `mail.mysalesforcedemo.com`. Enforces Mailgun's per-hour recipient cap, paces
 * sends evenly across the window, and handles 429s by pausing until the window
 * clears.
 *
 * Usage:
 *
 * ```ts
 * const mailer = new BatchMailer({ total: recipients.length });
 * for (const r of recipients) {
 *   await mailer.send({ to: r.email, subject, html, text }, r.email);
 * }
 * mailer.summary();
 * ```
 */
export class BatchMailer {
  private readonly cap: number;
  private readonly windowMs: number;
  private readonly pace: boolean;
  private readonly paceMs: number;
  private readonly onSend?: BatchMailerOptions["onSend"];
  private readonly total: number | null;
  private readonly startedAt = Date.now();

  private sentAt: number[] = [];
  private totalSent = 0;
  private totalFailed = 0;

  constructor(opts: BatchMailerOptions & { total?: number } = {}) {
    this.cap = opts.cap ?? DEFAULT_HOURLY_SAFE_CAP;
    this.windowMs = opts.windowMs ?? HOUR_MS;
    this.pace = opts.pace ?? true;
    this.paceMs = Math.ceil(this.windowMs / this.cap);
    this.onSend = opts.onSend;
    this.total = opts.total ?? null;

    if (this.cap > MAILGUN_HOURLY_CAP) {
      throw new Error(
        `BatchMailer cap (${this.cap}) exceeds Mailgun's hourly limit of ${MAILGUN_HOURLY_CAP} for mail.mysalesforcedemo.com. Request a higher limit from Mailgun first.`
      );
    }
  }

  /**
   * If the script expects to send `total` messages, log an up-front runtime
   * estimate so long runs are predictable.
   */
  logPlan(total: number, label = "recipients"): void {
    const hours = total / this.cap;
    const estMs = Math.max(total * this.paceMs, hours * this.windowMs);
    console.log(
      `[batchMailer] ${total} ${label} @ ${this.cap}/hour → estimated runtime ~${fmtDuration(
        estMs
      )} (pace ${Math.round(this.paceMs / 1000)}s between sends).`
    );
  }

  async send(
    msg: SendBrandedEmailOptions,
    label = Array.isArray(msg.to) ? msg.to.join(",") : msg.to
  ): Promise<SendEmailResult> {
    await this.waitForSlot(label);

    const index = this.totalSent + this.totalFailed + 1;
    const result = await sendBrandedEmail(msg);
    this.sentAt.push(Date.now());

    if (result.success) {
      this.totalSent++;
    } else {
      this.totalFailed++;
    }

    this.onSend?.({
      index,
      total: this.total,
      label,
      result,
      sentInWindow: this.sentAt.length,
    });

    if (!result.success && this.looksLikeRateLimit(result.error)) {
      const waitMs = this.timeUntilSlotOpens() + 1000;
      console.warn(
        `[batchMailer] provider rate-limit (${result.error}); pausing ${fmtDuration(
          waitMs
        )} before next send.`
      );
      await sleep(Math.max(waitMs, 60_000));
      return result;
    }

    if (this.pace) {
      await sleep(this.paceMs);
    }
    return result;
  }

  summary(): { sent: number; failed: number; elapsedMs: number } {
    const elapsedMs = Date.now() - this.startedAt;
    console.log(
      `[batchMailer] done — sent ${this.totalSent}, failed ${this.totalFailed}, elapsed ${fmtDuration(
        elapsedMs
      )}.`
    );
    return { sent: this.totalSent, failed: this.totalFailed, elapsedMs };
  }

  private async waitForSlot(label: string): Promise<void> {
    const now = Date.now();
    this.sentAt = this.sentAt.filter((t) => now - t <= this.windowMs);
    if (this.sentAt.length < this.cap) return;

    const waitMs = this.timeUntilSlotOpens() + 500;
    const resumeAt = new Date(Date.now() + waitMs);
    console.log(
      `[batchMailer] cap ${this.cap}/hr reached; sleeping ${fmtDuration(
        waitMs
      )} — resumes ${resumeAt.toLocaleTimeString()} (next: ${label}).`
    );
    await sleep(waitMs);
    const after = Date.now();
    this.sentAt = this.sentAt.filter((t) => after - t <= this.windowMs);
  }

  private timeUntilSlotOpens(): number {
    if (this.sentAt.length === 0) return 0;
    const oldest = this.sentAt[0];
    return Math.max(0, this.windowMs - (Date.now() - oldest));
  }

  private looksLikeRateLimit(err: string | undefined): boolean {
    if (!err) return false;
    return /429|rate[\s-]?limit|too many requests/i.test(err);
  }
}
