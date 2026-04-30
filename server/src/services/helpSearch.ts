import { env } from "../config/env";

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const HELP_CONTENT = `
# AI Library Help Documentation

## Getting Started

### What is AI Library?
AI Library is your Salesforce toolkit for AI. It's a place where you can discover, save, and share four asset types that make working with AI tools faster and more effective:
- Prompts — ready-to-use instructions you send to AI tools
- Skills — URL-based capability packs (zip archives, repos, or docs) that teach AI tools how to behave
- Context — reference documents (style guides, policies, docs) the AI should know about
- Builds — pre-built solutions (apps, agents, workflows) you can deploy or adapt

### Who is this for?
Anyone at Salesforce who uses AI tools like Slackbot, Agentforce Vibes, Claude, Claude Cowork, ChatGPT, Gemini, Cursor, NotebookLM, or Saleo.

### How do I sign in?
Click "Continue with Google" on the login page using your Salesforce Google account. Auth is Google SSO — no separate password.

### What should I do first?
1. Accept the compliance acknowledgment that appears on first load (required every 96 hours)
2. Complete your profile (name, region, Department/OU, title, profile photo)
3. Browse Top Performers on the homepage
4. Try an asset by clicking "Use" — copies to your clipboard and/or launches the target tool
5. Favorite assets you like (heart icon)
6. If you have write permissions, click "Create" to add your first asset

### What are Smart Pick, New, Updated, and Popular badges?
- Smart Pick (pink star) — admin-curated featured assets
- New (green) — created within the last 7 days
- Updated (blue) — modified within the last 7 days (created earlier)
- Popular (orange flame) — 10+ favorites

### Where is the changelog?
The app footer shows the current version and links to /changelog with grouped release notes.

## Prompts

### What is a prompt?
A prompt is a set of instructions you give to an AI tool — tells it exactly what you need, in what format, and with what context.

### How do I find prompts?
Use Smart Search at the top of the homepage. It supports plain keywords, natural-language queries ("cursor prompts for code review"), auto-suggestions, removable filter chips, a ⌘K shortcut, and faceted filters with live counts per asset type and tool. Sort by Recent, Most Used, Name, or Updated At.

### How do I use a prompt?
1. Click a prompt card to open the detail page
2. Fill in any [VARIABLE] or {{VARIABLE}} fields — body preview updates live
3. Click "Use" (green) to copy the filled-in prompt, or the launch button to open it in the target tool
4. A toast confirms the action

### What are variables?
Placeholders like [KEY] or {{KEY}} defined in the editor with a label, optional default, and optional required flag. They're filled in at use time before copy/launch.

### How do I create a prompt?
1. Click "Create" → "New Prompt" (writers only)
2. Title (auto-sanitized) and summary
3. Body
4. Insert variables as needed
5. Target tool(s) + generated-output type
6. Visibility: Public / Team (same Department/OU as owner) / Private
7. Click Save — modal prompts you to pick Draft or Publish Now
If a potential duplicate is detected (exact body hash, 85%+ similar title, or same normalized URL for Skills/Builds), a Duplicate Warning modal shows the existing matches with links.

### How do I edit, archive, or permanently delete my prompt?
Detail page (owners only):
- Edit — saves a new version, optional changelog note
- Archive (amber) — soft-delete, preserves history
- Delete (red) — permanent delete with confirmation; cascades usage events, ratings, favorites, tags, variables, versions, and collection memberships

### How does versioning work?
Every edit to a Prompt, Skill, Context doc, or Build creates a new version (with optional changelog note). Versions are visible on detail pages and can be restored.

### Rating & favoriting
Users rate 1-5 stars. You can't rate your own assets, and the star widget is hidden on cards you own. Click the heart icon to favorite; favorite counts drive the Popular badge.

### How do I request a new tool?
In any prompt editor, click "Request a new tool" and fill the modal (name, Salesforce-approved status, details URL, description). Admins review submitted requests and approved tools show up in the picker automatically.

## Skills (URL-based)

### What is a skill?
A reusable capability pack — a Slackbot skill bundle, a Cursor .mdc rule, a Claude project skill, a Gemini custom Gem, etc. Skills in AI Library are URL-based (v1.2 migration): each skill points to where the skill lives (zip, repo, Quip, SharePoint).

### Fields on a skill
- Skill URL (required) — the canonical skill archive / document
- Support URL (optional) — docs, video, or thread explaining how to install and use it
- Target tool(s) (e.g. Slackbot, Agentforce Vibes, Cursor, Claude)
- Modality — text, code, image, video, audio, or multimodal (same categories as prompts)

### How do I use a skill?
Open the detail page, click the Skill URL to download/install into the target tool. Follow the Support URL for install steps if provided.

### How do I create a skill?
1. Host your skill somewhere and get a URL
2. Click "Create" → "New Skill"
3. Title, summary, Skill URL, optional Support URL, tool(s), modality, visibility
4. Save as Draft or Publish

### Skills also support
Star ratings (self-rating blocked), favorites, collection membership, versioning, archive, permanent delete, thumbnails, and share. Same feature set as prompts.

## Context

### What is context?
Reference materials the AI should know — style guides, documentation, policies, data dictionaries.

### Context vs. Skill vs. Prompt
- Context — information the AI should know (facts, rules)
- Skill — behavioral capability pack delivered as an installable bundle
- Prompt — a specific one-shot instruction

### How do I add context?
1. Create → New Context
2. Paste or write markdown
3. Optional Support URL (detail page shows a documentation icon that links out)
4. Add variables if helpful, tool(s), modality, visibility
5. Save as Draft or Publish

### Variables in context
Context documents support [KEY] and {{KEY}} placeholders like prompts. Interpolated markdown is what gets copied.

## Builds

### What is a Build?
A finished AI solution — apps, agents, workflows, demos, or tools you can run or fork.

### How do I use a Build?
Click a Build card, then click the Build URL to open the live solution. Optional Support URL for docs.

### How do I create a Build?
1. Create → New Build
2. Title, summary, Build URL, optional Support URL, tool(s), modality, visibility
3. Save as Draft or Publish
Builds support versioning (with changelog), favorites, ratings, collections, share, archive, and permanent delete.

## Collections

### What are collections?
Folders for organizing any mix of Prompts, Skills, Context, and Builds by project, campaign, or workflow.

### How do I create one and add assets?
Collections tab → name + description → Create. On any asset detail page, click the bookmark icon to add/remove from your collections. You can also add users to a collection as members.

### System collections
Auto-curated collections (one per supported tool, plus "Best of AI Library"). They show a lock-style badge and can't be edited by users. Admins can force a refresh.

## Using AI Tools

### Supported tools
Slackbot, Agentforce Vibes, Claude, Claude Cowork, ChatGPT, Gemini, Cursor, NotebookLM, Saleo, and Other (for tools not yet in the list — submit a Tool Request).

### Use vs. Launch
- "Use" (green) copies the interpolated prompt to your clipboard and shows a toast
- Launch button opens the target tool in a new tab with the prompt pre-filled where supported
- For tools without a deep-link, paste it manually

## Visibility & Roles

### Visibility levels (per asset)
- Public — anyone signed into AI Library (global, not Department/OU–scoped)
- Team — only your Operating Unit sees it
- Private — only you see it
Admins see all assets regardless of visibility.

### Roles
- ADMIN — full access, including admin tools and all assets
- OWNER — team owner, full write
- MEMBER — default writer; create/edit/favorite/rate/use
- VIEWER — read-only. @meshmesh.io accounts auto-become VIEWER. Contact an admin to be promoted to MEMBER.

## Search & Discovery

### Smart Search
Unified bar with natural-language parsing (Gemini-powered), auto-suggestions, relevance highlighting, removable filter chips, URL sync, debounce, and ⌘K focus.

### Faceted Filters
Below the search bar: clickable chips with live counts by asset type and tool.

### Ask AI (beta) on Help
The Ask AI box on this help page answers questions using help docs. Use it when you don't know where to look.

## Your Profile

### Updating your profile
Click the avatar top-right for the profile modal, or go to /settings for the full-page version. Update name, region, Department/OU, title, and photo. Region is for administration/reporting only (not Team visibility). Department/OU is required when finishing onboarding; title is optional.

### Profile photo
Upload JPEG/PNG/GIF/WebP, max 5MB. Stored on server under /uploads/.

## Your Content & Analytics

### Where is My Content?
/?mine=true — also reachable from Settings → My Content. Shows all your Prompts, Skills, Context, and Builds.

### What can I do there?
- Search within your own assets
- Filter by Status (Draft/Published/Archived)
- Sort Recent / Most Used / Name / Updated At
- Toggle List view (Name/Status/Edit) vs cards
- "Show Analytics" adds inline metrics to cards
- Paginate

### My Analytics
Settings → My Analytics (or /?mine=true&showAnalytics=true). Sortable table with views, uses (COPY+LAUNCH only, not views), ratings count+average, and favorites per asset.

### Export
"Export CSV" in My Analytics downloads a spreadsheet. Use the "Columns" dropdown to hide columns before exporting.

### Privacy
Only aggregate metrics — you cannot see which specific users viewed, used, rated, or favorited your assets.

## API Keys & MCP Integration

### What is MCP?
Model Context Protocol lets Cursor, Claude, and other MCP-compatible tools talk to AI Library directly. You can say "add this prompt to the AI Library" in Cursor and it creates it tagged to your account.

### Generating a key
Settings → API Keys → Generate. Full key (alib_xxx…) is shown once — copy it. Optional expiration; revoke any time.

### API endpoints
Bearer-auth /api/v1/prompts, /api/v1/skills, /api/v1/context, /api/v1/builds, /api/v1/me.

### MCP tools exposed
add_prompt, add_skill, add_context, add_build, whoami — via the @ailibrary/mcp-server package.

### Duplicate handling
409 Conflict with matched assets when your create/update would duplicate an existing one.

## Duplicate Detection

### What's flagged
- Exact body match (SHA-256 of normalized body) — Prompts, Context
- Exact title match (normalized)
- Similar title (Levenshtein 85%+)
- Exact URL match (normalized Skill URL or Build URL)

### Can I proceed anyway?
Yes — the Duplicate Warning modal is informational and you can continue if the new asset is meaningfully different. Hard unique-constraint duplicates (identical body hash) must be resolved first.

## Compliance & Policies

### Compliance modal
Shown on first load and every 96 hours. Reminds you of Salesforce SAM Team policies and the Data Classification Policy. Choose "I Understand" (stores acknowledgment) or "Nope, get me out of here" (redirects to salesforce.com).

### Policies
Links to the SAM Policy and Data Classification Policy on Basecamp live in the modal.

### What never to upload
Confidential customer data, regulated data (PII, PHI, payment), restricted content. Keep sensitive assets Private or ask in #help-ailibrary before publishing.

## Tips & Best Practices

### Effective prompts
- Be specific, include context, specify format, use variables, test before publishing

### Getting more from AI tools
- Load skills into system instructions or custom-skill slots
- Provide context docs for domain work
- Iterate on prompts
- Share what works

### Contributing
- Publish what's worked for you, rate assets you use, create skills for frequent tasks, add context for domain knowledge, publish Builds for end-to-end solutions

### Still stuck?
Use the "Get help in #help-ailibrary" button on the Help page or try Ask AI.
`;

function buildHelpSearchPrompt(question: string): string {
  return `You are a helpful assistant for AI Library, an internal Salesforce tool for sharing AI prompts, skills, context documents, and builds.

Answer the user's question based ONLY on the help documentation provided below. Be concise, friendly, and direct. If the question cannot be answered from the documentation, say so and suggest they contact support.

Format your response in a clear, readable way. Use bullet points or numbered lists when appropriate. Keep your answer focused and practical.

---
HELP DOCUMENTATION:
${HELP_CONTENT}
---

USER QUESTION: ${question}

ANSWER:`;
}

export type HelpSearchResult = {
  answer: string;
  source: "ai";
};

export async function searchHelp(question: string): Promise<HelpSearchResult> {
  const apiKey = env.nanoBananaApiKey;
  if (!apiKey) {
    throw new Error("AI search is not configured. Please use the regular search.");
  }

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
              text: buildHelpSearchPrompt(question),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI search failed (${response.status}): ${errorText.slice(0, 300)}`);
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

  const answer = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!answer) {
    throw new Error("AI search did not return an answer.");
  }

  return {
    answer: answer.trim(),
    source: "ai",
  };
}
