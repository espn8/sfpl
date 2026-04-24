import { env } from "../config/env";
import { SUMMARY_MAX_CHARS } from "../lib/summaryLimits";

const GEMINI_TEXT_MODEL = "gemini-2.5-flash";
const GEMINI_TEXT_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`;

export type AssetKindForRewrite = "prompt" | "skill" | "context" | "build";

export type SummaryRewriteInput = {
  draft: string;
  title?: string;
  assetType: AssetKindForRewrite;
};

function assetLabel(kind: AssetKindForRewrite): string {
  switch (kind) {
    case "prompt":
      return "prompt";
    case "skill":
      return "skill (a downloadable plugin, extension, or toolkit)";
    case "context":
      return "context document (rules, references, or guides)";
    case "build":
      return "build (a functional tool or app people can use)";
    default:
      return "asset";
  }
}

function buildRewritePrompt(input: SummaryRewriteInput): string {
  return [
    `You are editing a catalog entry for a ${assetLabel(input.assetType)}.`,
    "Rewrite the author's draft summary as ONE short sentence answering \"why would someone use this?\".",
    `Hard limit: ${SUMMARY_MAX_CHARS} characters or fewer. Prefer shorter. Never exceed the limit.`,
    "Tone: clear, helpful, neutral, action-oriented. No marketing fluff, no emojis, no quotes.",
    "Do not restate the title verbatim. Do not add trailing punctuation beyond a single period.",
    "Reply with ONLY the rewritten sentence — no preface, no alternatives, no explanation.",
    input.title ? `Title: ${input.title}` : "",
    `Draft summary: ${input.draft}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function cleanupResponse(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^["'`]+|["'`]+$/g, "");
  text = text.replace(/\s+/g, " ").trim();
  if (text.length > SUMMARY_MAX_CHARS) {
    const clipped = text.slice(0, SUMMARY_MAX_CHARS);
    const lastSpace = clipped.lastIndexOf(" ");
    text = (lastSpace > SUMMARY_MAX_CHARS - 40 ? clipped.slice(0, lastSpace) : clipped).trim();
  }
  return text;
}

export async function generateSummaryRewrite(input: SummaryRewriteInput): Promise<string> {
  const apiKey = env.nanoBananaApiKey;
  if (!apiKey) {
    throw new Error("NANO_BANANA_API_KEY is not configured.");
  }

  const response = await fetch(`${GEMINI_TEXT_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: buildRewritePrompt(input) }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 160,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini summary rewrite failed (${response.status}): ${errorText.slice(0, 300)}`,
    );
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join(" ") ?? "";
  const cleaned = cleanupResponse(text);
  if (!cleaned) {
    throw new Error("Gemini summary rewrite returned no text.");
  }
  return cleaned;
}
