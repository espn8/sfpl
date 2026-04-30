import { env } from "../config/env";

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const VALID_TOOLS = [
  "agentforce_vibes",
  "chatgpt",
  "claude_code",
  "claude_cowork",
  "cursor",
  "gemini",
  "meshmesh",
  "notebooklm",
  "other",
  "saleo",
  "slackbot",
] as const;

const VALID_ASSET_TYPES = ["prompt", "skill", "context"] as const;
const VALID_MODALITIES = ["text", "code", "image", "video", "audio", "multimodal"] as const;

type Tool = (typeof VALID_TOOLS)[number];
type AssetType = (typeof VALID_ASSET_TYPES)[number];
type Modality = (typeof VALID_MODALITIES)[number];

export type ParsedSearchQuery = {
  tool: Tool | null;
  assetType: AssetType | null;
  modality: Modality | null;
  searchTerms: string;
};

const TOOL_ALIASES: Record<string, Tool> = {
  "agentforce vibes": "agentforce_vibes",
  agentforce_vibes: "agentforce_vibes",
  agentforcevibes: "agentforce_vibes",
  agentforce: "agentforce_vibes",
  vibes: "agentforce_vibes",
  chatgpt: "chatgpt",
  "chat gpt": "chatgpt",
  gpt: "chatgpt",
  openai: "chatgpt",
  claude: "claude_code",
  "claude code": "claude_code",
  claudecode: "claude_code",
  "claude cowork": "claude_cowork",
  claudecowork: "claude_cowork",
  cowork: "claude_cowork",
  cursor: "cursor",
  gemini: "gemini",
  meshmesh: "meshmesh",
  notebooklm: "notebooklm",
  "notebook lm": "notebooklm",
  saleo: "saleo",
  slackbot: "slackbot",
  "slack bot": "slackbot",
  slack: "slackbot",
};

const ASSET_TYPE_ALIASES: Record<string, AssetType> = {
  prompt: "prompt",
  prompts: "prompt",
  skill: "skill",
  skills: "skill",
  context: "context",
  contexts: "context",
  "context document": "context",
  "context documents": "context",
  document: "context",
  documents: "context",
};

const MODALITY_ALIASES: Record<string, Modality> = {
  text: "text",
  code: "code",
  coding: "code",
  image: "image",
  images: "image",
  picture: "image",
  pictures: "image",
  video: "video",
  videos: "video",
  audio: "audio",
  sound: "audio",
  multimodal: "multimodal",
  multi: "multimodal",
};

function tryLocalParse(query: string): ParsedSearchQuery | null {
  const lowerQuery = query.toLowerCase().trim();
  const words = lowerQuery.split(/\s+/);

  let tool: Tool | null = null;
  let assetType: AssetType | null = null;
  let modality: Modality | null = null;
  const remainingWords: string[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const twoWordPhrase = i < words.length - 1 ? `${word} ${words[i + 1]}` : null;

    if (!tool && twoWordPhrase && TOOL_ALIASES[twoWordPhrase]) {
      tool = TOOL_ALIASES[twoWordPhrase];
      usedIndices.add(i);
      usedIndices.add(i + 1);
      i++;
      continue;
    }
    if (!tool && TOOL_ALIASES[word]) {
      tool = TOOL_ALIASES[word];
      usedIndices.add(i);
      continue;
    }

    if (!assetType && twoWordPhrase && ASSET_TYPE_ALIASES[twoWordPhrase]) {
      assetType = ASSET_TYPE_ALIASES[twoWordPhrase];
      usedIndices.add(i);
      usedIndices.add(i + 1);
      i++;
      continue;
    }
    if (!assetType && ASSET_TYPE_ALIASES[word]) {
      assetType = ASSET_TYPE_ALIASES[word];
      usedIndices.add(i);
      continue;
    }
  }

  for (let i = 0; i < words.length; i++) {
    if (usedIndices.has(i)) continue;
    const word = words[i];

    if (!modality && MODALITY_ALIASES[word]) {
      const nextWord = i < words.length - 1 ? words[i + 1] : null;
      const prevWord = i > 0 ? words[i - 1] : null;
      // "code review" is a task phrase, not "code output modality."
      const isModalityNegatedByPhrase = word === "code" && nextWord === "review";
      const isLikelyModality =
        !isModalityNegatedByPhrase &&
        Boolean(
          (nextWord &&
            (ASSET_TYPE_ALIASES[nextWord] ||
              nextWord === "generation" ||
              nextWord === "output")) ||
            (prevWord && (prevWord === "generate" || prevWord === "create")),
        );

      if (isLikelyModality) {
        modality = MODALITY_ALIASES[word];
        usedIndices.add(i);
        continue;
      }
    }
  }

  for (let i = 0; i < words.length; i++) {
    if (usedIndices.has(i)) continue;
    const word = words[i];

    if (word === "for" || word === "in" || word === "with" || word === "that" || word === "about") {
      continue;
    }

    remainingWords.push(word);
  }

  if (tool || assetType || modality) {
    return {
      tool,
      assetType,
      modality,
      searchTerms: remainingWords.join(" "),
    };
  }

  return null;
}

/**
 * True when the query likely mentions facet vocabulary (tools, asset kinds, modalities).
 * Plain keyword / title searches return false so we do not call Gemini — the model often
 * invented filters or emptied searchTerms and broke literal title matches (e.g. "keep my job").
 */
function queryLooksLikeGeminiFacetedParse(lowerTrimmed: string): boolean {
  const patterns: RegExp[] = [
    /\b(agentforce|vibes|chatgpt|gpt|openai|claude|cursor|gemini|meshmesh|notebook\s*lm|notebooklm|saleo|slackbot|slack|cowork)\b/,
    /\b(prompts?|skills?|contexts?|documents?|document)\b/,
    /\b(builds?)\b/,
    /\b(text|code|image|video|audio|multimodal)\b/,
  ];
  return patterns.some((re) => re.test(lowerTrimmed));
}

function buildParsePrompt(query: string): string {
  return `You are a search query parser for SF AI Library, a tool for sharing AI prompts, skills, and context documents.

Parse the user's natural language search query and extract structured filters.

Available filters:
- tool: One of: agentforce_vibes, chatgpt, claude_code, claude_cowork, cursor, gemini, meshmesh, notebooklm, saleo, slackbot
- assetType: One of: prompt, skill, context
- modality: One of: text, code, image, video, audio, multimodal

Return a JSON object with these fields:
- tool: The detected tool filter (string or null)
- assetType: The detected asset type filter (string or null)
- modality: The detected output modality filter (string or null)
- searchTerms: The remaining search keywords after extracting filters (string)

Examples:
- "cursor prompts for code review" → {"tool":"cursor","assetType":"prompt","modality":null,"searchTerms":"code review"}
- "skills that help with sales emails" → {"tool":null,"assetType":"skill","modality":null,"searchTerms":"sales emails"}
- "claude code generation prompts" → {"tool":"claude_code","assetType":"prompt","modality":"code","searchTerms":"generation"}
- "how to write better emails" → {"tool":null,"assetType":null,"modality":null,"searchTerms":"how to write better emails"}

USER QUERY: ${query}

Return ONLY the JSON object, no explanation:`;
}

export async function parseSearchQuery(query: string): Promise<ParsedSearchQuery> {
  const localResult = tryLocalParse(query);
  if (localResult) {
    return localResult;
  }

  const apiKey = env.nanoBananaApiKey;
  const trimmedQuery = query.trim();
  if (!apiKey) {
    return {
      tool: null,
      assetType: null,
      modality: null,
      searchTerms: trimmedQuery,
    };
  }

  if (!queryLooksLikeGeminiFacetedParse(trimmedQuery.toLowerCase())) {
    return {
      tool: null,
      assetType: null,
      modality: null,
      searchTerms: trimmedQuery,
    };
  }

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildParsePrompt(query),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 256,
        },
      }),
    });

    if (!response.ok) {
      return {
        tool: null,
        assetType: null,
        modality: null,
        searchTerms: query.trim(),
      };
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    };

    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return {
        tool: null,
        assetType: null,
        modality: null,
        searchTerms: query.trim(),
      };
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        tool: null,
        assetType: null,
        modality: null,
        searchTerms: query.trim(),
      };
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      tool?: string | null;
      assetType?: string | null;
      modality?: string | null;
      searchTerms?: string;
    };

    const validTool = parsed.tool && VALID_TOOLS.includes(parsed.tool as Tool) ? (parsed.tool as Tool) : null;
    const validAssetType =
      parsed.assetType && VALID_ASSET_TYPES.includes(parsed.assetType as AssetType)
        ? (parsed.assetType as AssetType)
        : null;
    const validModality =
      parsed.modality && VALID_MODALITIES.includes(parsed.modality as Modality) ? (parsed.modality as Modality) : null;

    const termsFromModel = (parsed.searchTerms ?? query).trim();
    return {
      tool: validTool,
      assetType: validAssetType,
      modality: validModality,
      searchTerms: termsFromModel || query.trim(),
    };
  } catch {
    return {
      tool: null,
      assetType: null,
      modality: null,
      searchTerms: query.trim(),
    };
  }
}
