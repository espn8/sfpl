import { env } from "../config/env";

const NANO_BANANA_MODEL = "nano-banana-1.0";
const NANO_BANANA_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${NANO_BANANA_MODEL}:generateContent`;

function buildThumbnailPrompt(title: string, summary: string | null, body: string): string {
  return [
    "Create a fun, quirky thumbnail illustration in Salesforce brand colors.",
    "Use a playful visual style that feels energetic and modern.",
    "Prioritize these colors: #0176D3, #032D60, #06A59A, #EAF5FE, #FFB75D.",
    "Do not include logos, product screenshots, or any readable text.",
    `Prompt title: ${title}`,
    `Prompt summary: ${summary ?? "N/A"}`,
    `Prompt body excerpt: ${body.slice(0, 500)}`,
  ].join("\n");
}

type GenerateThumbnailInput = {
  title: string;
  summary: string | null;
  body: string;
};

export async function generatePromptThumbnail(input: GenerateThumbnailInput): Promise<string> {
  const apiKey = env.nanoBananaApiKey;
  if (!apiKey) {
    throw new Error("NANO_BANANA_API_KEY is not configured.");
  }

  const response = await fetch(`${NANO_BANANA_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: buildThumbnailPrompt(input.title, input.summary, input.body),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.8,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Nano Banana request failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: string; data?: string };
          fileData?: { mimeType?: string; fileUri?: string };
        }>;
      };
    }>;
  };

  const part = payload.candidates?.[0]?.content?.parts?.[0];
  const inline = part?.inlineData;
  if (inline?.data) {
    const mimeType = inline.mimeType ?? "image/png";
    return `data:${mimeType};base64,${inline.data}`;
  }

  const fileUri = part?.fileData?.fileUri;
  if (fileUri) {
    return fileUri;
  }

  throw new Error("Nano Banana response did not contain image data.");
}
