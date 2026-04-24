import { env } from "../config/env";

export type BrandedEmailOptions = {
  /**
   * Short inbox preview text (shown after the subject in most email clients).
   * Keep it under ~100 chars.
   */
  preheader?: string;
  /**
   * Optional subject — used in the text version's title. Falls back to a generic
   * brand label if not provided.
   */
  title?: string;
};

const BRAND_NAME = "Salesforce AI Library";
const PRODUCT_NAME = "AI Library";
const HELP_SLACK_URL = "https://salesforce.enterprise.slack.com/archives/C0ATAP14WEQ";
const HELP_SLACK_CHANNEL = "#help-ailibrary";
const COPYRIGHT_YEAR = "2026";

function getBaseUrl(): string {
  return env.appBaseUrl.replace(/\/+$/, "");
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Wrap arbitrary body HTML in the site-branded email chrome.
 *
 * The layout uses tables + inline styles (required for broad email-client
 * support), with a <style> block that adds mobile responsive rules and a
 * `prefers-color-scheme: dark` variant. Colors mirror the values in
 * `client/src/styles/theme.css`, and the header mimics the rounded logo +
 * wordmark card used by `AppShell`.
 */
export function wrapEmailHtml(bodyHtml: string, options: BrandedEmailOptions = {}): string {
  const baseUrl = getBaseUrl();
  const logoUrl = `${baseUrl}/salesforce-logo.png`;
  const helpUrl = `${baseUrl}/help`;
  const homeUrl = `${baseUrl}/`;
  const preheader = options.preheader ?? "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${escapeAttr(options.title ?? BRAND_NAME)}</title>
    <!--[if mso]>
    <style type="text/css">
      table, td, div, h1, h2, h3, p, a { font-family: Arial, Helvetica, sans-serif !important; }
    </style>
    <![endif]-->
    <style>
      body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
      table { border-collapse: collapse !important; }
      body { margin: 0 !important; padding: 0 !important; width: 100% !important; }

      .email-body { background-color: #f7f9fc; }
      .email-card {
        background-color: #ffffff;
        border: 1px solid #d7dfea;
        border-radius: 8px;
      }
      .email-text { color: #032d60; }
      .email-muted { color: #51678d; }
      .email-link { color: #0176d3; text-decoration: underline; }
      .email-link-quiet { color: #51678d; text-decoration: underline; }
      .email-divider { border-top: 1px solid #d7dfea; line-height: 0; font-size: 0; }

      .email-button {
        background-color: #2e844a;
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 999px;
        padding: 12px 24px;
        display: inline-block;
        font-weight: 600;
      }

      @media screen and (max-width: 600px) {
        .email-container { width: 100% !important; max-width: 100% !important; }
        .email-pad { padding-left: 16px !important; padding-right: 16px !important; }
        .email-pad-sm { padding-left: 12px !important; padding-right: 12px !important; }
        .email-stack { display: block !important; width: 100% !important; text-align: left !important; }
        .email-footer-right { text-align: left !important; padding-top: 12px !important; }
        .email-h1 { font-size: 20px !important; line-height: 28px !important; }
      }

      @media (prefers-color-scheme: dark) {
        body, .email-body { background-color: #0b1020 !important; }
        .email-card { background-color: #121a2d !important; border-color: #2c3853 !important; }
        .email-text { color: #e8efff !important; }
        .email-muted { color: #afbdd8 !important; }
        .email-link { color: #1b96ff !important; }
        .email-link-quiet { color: #afbdd8 !important; }
        .email-divider { border-top-color: #2c3853 !important; }
      }
    </style>
  </head>
  <body class="email-body" style="margin:0;padding:0;background-color:#f7f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">
      ${escapeAttr(preheader)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-body" style="background-color:#f7f9fc;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="email-container" style="width:600px;max-width:600px;">
            <!-- Header -->
            <tr>
              <td class="email-card email-pad" style="background-color:#ffffff;border:1px solid #d7dfea;border-radius:8px;padding:14px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <a href="${escapeAttr(homeUrl)}" style="text-decoration:none;color:#032d60;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="vertical-align:middle;padding-right:10px;">
                              <img src="${escapeAttr(logoUrl)}" alt="Salesforce" width="40" height="40" style="display:block;height:40px;width:auto;border:0;">
                            </td>
                            <td class="email-text" style="vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:#032d60;">
                              ${escapeAttr(PRODUCT_NAME)}
                            </td>
                          </tr>
                        </table>
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr><td style="height:12px;line-height:12px;font-size:12px;">&nbsp;</td></tr>

            <!-- Body -->
            <tr>
              <td class="email-card email-pad email-text" style="background-color:#ffffff;border:1px solid #d7dfea;border-radius:8px;padding:24px;color:#032d60;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:22px;">
                ${bodyHtml}
              </td>
            </tr>

            <tr><td style="height:12px;line-height:12px;font-size:12px;">&nbsp;</td></tr>

            <!-- Footer -->
            <tr>
              <td class="email-card email-pad" style="background-color:#ffffff;border:1px solid #d7dfea;border-radius:8px;padding:16px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td class="email-stack" style="vertical-align:middle;">
                      <img src="${escapeAttr(logoUrl)}" alt="Salesforce" width="36" height="36" style="display:block;height:36px;width:auto;border:0;">
                    </td>
                    <td class="email-stack email-footer-right email-muted" align="right" style="vertical-align:middle;text-align:right;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;color:#51678d;">
                      <a href="${escapeAttr(helpUrl)}" class="email-link-quiet" style="color:#51678d;text-decoration:underline;margin-right:12px;">Help</a>
                      <a href="${escapeAttr(HELP_SLACK_URL)}" class="email-link-quiet" style="color:#51678d;text-decoration:underline;">${escapeAttr(HELP_SLACK_CHANNEL)}</a>
                    </td>
                  </tr>
                </table>
                <div style="height:8px;line-height:8px;font-size:8px;">&nbsp;</div>
                <div class="email-muted" style="text-align:right;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#51678d;line-height:18px;">
                  Copyright ${COPYRIGHT_YEAR}. All Rights Reserved. ${escapeAttr(BRAND_NAME)}.
                </div>
              </td>
            </tr>

            <tr><td style="height:8px;line-height:8px;font-size:8px;">&nbsp;</td></tr>

            <tr>
              <td class="email-muted" style="text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;color:#51678d;padding:8px 12px;line-height:16px;">
                You are receiving this email because of your activity in the ${escapeAttr(PRODUCT_NAME)}.<br>
                <a href="${escapeAttr(homeUrl)}" class="email-link-quiet" style="color:#51678d;text-decoration:underline;">${escapeAttr(baseUrl)}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Wrap plain-text content in a lightweight branded header/footer, used as the
 * fallback for clients that cannot render HTML email.
 */
export function wrapEmailText(bodyText: string, options: BrandedEmailOptions = {}): string {
  const baseUrl = getBaseUrl();
  const helpUrl = `${baseUrl}/help`;
  const divider = "=".repeat(44);
  const thinDivider = "-".repeat(44);
  const preheader = options.preheader ? `${options.preheader}\n\n` : "";

  return `${divider}
  ${BRAND_NAME}
${divider}

${preheader}${bodyText.trim()}

${thinDivider}
Need help?
  Help:  ${helpUrl}
  Slack: ${HELP_SLACK_CHANNEL} (${HELP_SLACK_URL})
${thinDivider}
Copyright ${COPYRIGHT_YEAR}. All Rights Reserved.
${BRAND_NAME} - ${baseUrl}
`;
}
