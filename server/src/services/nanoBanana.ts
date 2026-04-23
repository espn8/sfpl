import { env } from "../config/env";

const NANO_BANANA_MODEL = "gemini-2.5-flash-image";
const NANO_BANANA_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${NANO_BANANA_MODEL}:generateContent`;

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function attemptGeneration(input: GenerateThumbnailInput, apiKey: string): Promise<string> {
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
        responseModalities: ["IMAGE"],
        temperature: 0.8,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed (${response.status}): ${errorText.slice(0, 300)}`);
  }

  type ResponsePart = {
    text?: string;
    inlineData?: { mimeType?: string; data?: string };
    fileData?: { mimeType?: string; fileUri?: string };
  };

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: ResponsePart[];
      };
    }>;
  };

  const parts = payload.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    const inline = part.inlineData;
    if (inline?.data) {
      const mimeType = inline.mimeType ?? "image/png";
      return `data:${mimeType};base64,${inline.data}`;
    }

    const fileUri = part.fileData?.fileUri;
    if (fileUri) {
      return fileUri;
    }
  }

  throw new Error(`Response did not contain image data (parts: ${parts.length})`);
}

export async function generatePromptThumbnail(input: GenerateThumbnailInput): Promise<string> {
  const apiKey = env.nanoBananaApiKey;
  if (!apiKey) {
    console.error("[NanoBanana] API key not configured - set NANO_BANANA_API_KEY environment variable");
    throw new Error("NANO_BANANA_API_KEY is not configured.");
  }

  console.log(`[NanoBanana] Requesting image generation for: "${input.title}"`);

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await attemptGeneration(input, apiKey);
      if (attempt > 1) {
        console.log(`[NanoBanana] Succeeded on attempt ${attempt} for: "${input.title}"`);
      } else {
        console.log(`[NanoBanana] Successfully generated image for: "${input.title}"`);
      }
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[NanoBanana] Attempt ${attempt}/${MAX_RETRIES} failed for "${input.title}": ${lastError.message}`);

      if (attempt < MAX_RETRIES) {
        const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`[NanoBanana] Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }

  console.error(`[NanoBanana] All ${MAX_RETRIES} attempts failed for: "${input.title}"`);
  throw lastError ?? new Error("Image generation failed after all retries");
}
