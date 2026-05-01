import { useState, useMemo } from "react";

type HelpArticle = {
  question: string;
  answer: string;
};

type HelpSection = {
  id: string;
  title: string;
  articles: HelpArticle[];
};

const helpContent: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    articles: [
      {
        question: "What is AI Library?",
        answer:
          "AI Library is your Salesforce toolkit for AI. It's a place where you can discover, save, and share the four core asset types that make working with AI tools faster and more effective:\n• Prompts — ready-to-use instructions you send to AI tools\n• Skills — reusable capability packs (URL-based archives) that teach AI tools how to behave\n• Context — reference documents (style guides, policies, docs) the AI should know about\n• Builds — pre-built solutions and tools (apps, agents, workflows) you can deploy or adapt\n\nThink of it as a shared recipe book: the recipes are AI assets, and you get to use — and contribute — the best ones.",
      },
      {
        question: "Who is this for?",
        answer:
          "You, if you use AI tools like Slackbot, Agentforce Vibes, Claude, Claude Cowork, ChatGPT, Gemini, Cursor, or NotebookLM. Whether you're writing emails, generating code, analyzing data, building agents, or brainstorming ideas — if you use AI at work, AI Library is for you.",
      },
      {
        question: "How do I sign in?",
        answer:
          'Click "Continue with Google" on the login page using your Salesforce Google account. Your session is managed by Google SSO — no separate password needed.',
      },
      {
        question: "What should I do first?",
        answer:
          '1. Accept the compliance notice (see "Compliance & Policies" below) — it pops up on first load\n2. Complete your profile (name, region, Department/OU, title, and optional profile photo)\n3. Browse the homepage to see Top Assets This Week (7-day views + uses), weekly contributor and activity leaderboards, and featured assets\n4. Try using a prompt by clicking "Use" on any card — it copies to your clipboard and/or launches the target tool\n5. Save assets you like by clicking the heart (favorite) icon\n6. Create your first asset using the "Create" button or the hero cards',
      },
      {
        question: "What are Smart Picks, New, Updated, and Popular badges?",
        answer:
          "Asset cards and detail pages display badges so you can spot the best content at a glance:\n• Smart Pick (pink star) — curated, recommended assets highlighted by admins\n• New (green) — created within the last 7 days\n• Updated (blue) — modified within the last 7 days (but created earlier)\n• Popular (orange flame) — assets with 10+ favorites",
      },
      {
        question: "Where is the changelog / release notes?",
        answer:
          'The footer on every page shows the current app version and links to "/changelog", which lists all feature additions and fixes grouped by version and date. Click the version number in the footer to jump there any time.',
      },
    ],
  },
  {
    id: "prompts",
    title: "Prompts",
    articles: [
      {
        question: "What is a prompt?",
        answer:
          "A prompt is a set of instructions you give to an AI tool. A good prompt tells the AI exactly what you need, in what format, and with what context. AI Library stores prompts that have been tested and proven to work well.",
      },
      {
        question: "How do I find prompts?",
        answer:
          'Use the unified Smart Search bar at the top of the homepage. You can:\n• Type keywords or an asset title — the catalog matches titles, summaries, and bodies for prompts and context; skills also match the install URL; results favor title matches when you search (highlighting where supported)\n• Use natural language like "cursor prompts for code review" — when your query mentions tools or asset kinds, our Gemini-powered parser can turn it into structured filters; plain title-style phrases stay literal\n• Press ⌘K (Cmd-K) to focus the search bar from anywhere\n• Click a faceted filter chip (Prompts, Skills, Context, Builds, or any tool) to narrow the list\n• Sort by Most Recent, Most Used, Most Used This Week, Name, or Updated At',
      },
      {
        question: "How do I use a prompt?",
        answer:
          '1. Click on any prompt card to open the detail page\n2. If the prompt has variables (shown as [VARIABLE] or {{VARIABLE}}), fill in the fields — the body preview updates live\n3. Click "Use" (Salesforce green button) to copy the filled-in prompt, or use the launch button to open it directly in your chosen AI tool\n4. A toast notification confirms the copy or launch',
      },
      {
        question: "What are variables?",
        answer:
          "Variables are customizable placeholders in a prompt. For example, a prompt might include [COMPANY_NAME] or {{TOPIC}}. When you use the prompt, you fill in these fields with your specific information, and the prompt text updates automatically before it's copied or launched. Variables have a key, human-friendly label, optional default value, and an optional required flag.",
      },
      {
        question: "How do I create a prompt?",
        answer:
          '1. Click "Create" in the top navigation and pick "New Prompt" (writers only — see "Roles" below)\n2. Give your prompt a title and summary (the title is auto-sanitized so you don\'t end up with "My Prompt Prompt")\n3. Write the prompt body\n4. Add variables if needed — click "Insert" to drop [KEY] placeholders into the body, or type them manually\n5. Pick one or more target tools and a generated-output type (text, code, image, etc.)\n6. Choose a visibility (Public, Team, or Private — see "Visibility" below)\n7. Click Save — a modal prompts you to choose Draft or Publish Now\n\nIf AI Library detects a likely duplicate (matching title, same body, or 85%+ similar title), a Duplicate Warning modal shows the existing assets with links so you can decide whether to continue.',
      },
      {
        question: "How do I edit, archive, or permanently delete a prompt?",
        answer:
          'On any prompt you own, the detail page shows three action buttons:\n• Edit — opens the editor; changes save as a new version (see "Versioning")\n• Archive (amber) — soft-delete; hides the prompt from lists but preserves history\n• Delete (red) — permanent delete with a confirmation modal; cascades through usage events, ratings, favorites, tags, variables, versions, and collection memberships. This cannot be undone.',
      },
      {
        question: "How does versioning work?",
        answer:
          'Every edit to a Prompt, Skill, Context document, or Build creates a new version automatically. You can add an optional "changelog" note when saving to describe what changed. Versions are visible on the detail page, and you can restore a previous version if needed.',
      },
      {
        question: "What do the ratings mean?",
        answer:
          "Users can rate assets from 1-5 stars based on how helpful they were. Higher-rated assets appear more prominently in search results and Top Performers. You cannot rate your own assets, and the rate-stars widget is hidden on cards for assets you own.",
      },
      {
        question: "How do I favorite an asset?",
        answer:
          "Click the heart icon on any Prompt, Skill, Context, or Build detail page — or use the inline favorite toggle on asset cards. Favorited assets are easier to find later and the favorite count powers the Popular badge.",
      },
      {
        question: "How do I request a new tool to be added?",
        answer:
          'If the tool you use isn\'t in the list, open any prompt editor, click "Request a new tool," and fill out the modal (name, Salesforce approval status, details URL, description). Admins review requests on the admin page and you\'ll see new approved tools appear in the picker.',
      },
    ],
  },
  {
    id: "skills",
    title: "Skills",
    articles: [
      {
        question: "What is a skill?",
        answer:
          "A skill is a reusable, packaged capability you can load into an AI tool — for example, a Slackbot skill pack, a Cursor .mdc rule, a Claude project skill, or a Gemini custom Gem. Unlike prompts (which are one-time instructions), skills teach an AI tool how to behave on an ongoing basis for a specific task.",
      },
      {
        question: "How do skills work now (URL-based)?",
        answer:
          'Skills in AI Library are URL-based. Instead of pasting long markdown into the library, each skill points to where the skill actually lives (for example, a zipped skill archive, a Quip doc, a GitHub repo, or a SharePoint link). Fields on every skill:\n• Skill URL (required) — the canonical link to the skill archive / document\n• Support URL (optional) — a link to docs, a video, or a Slack thread that explains how to install and use the skill\n• Target tool — e.g. Slackbot, Agentforce Vibes, Cursor, Claude, Gemini\n\nThis migration happened in v1.2 — existing text-body skills were replaced with URL-based entries.',
      },
      {
        question: "What are some examples of skills?",
        answer:
          '• "SE SFR Prompt Pack" — a Slackbot skill bundle for Solution Engineers\n• "Code Reviewer" — a Cursor rule that reviews diffs for security and style\n• "Meeting Summarizer" — a Gemini Gem that formats meeting notes\n• "Salesforce Tone" — a Claude project skill that writes in Salesforce voice',
      },
      {
        question: "How do I use a skill?",
        answer:
          'Open the skill detail page and click the Skill URL to download or install the skill into the target tool. The Support URL (if provided) walks you through installation step-by-step. Because skills live outside AI Library, the exact install flow depends on the tool.',
      },
      {
        question: "How do I create a skill?",
        answer:
          '1. Host your skill somewhere (zip archive, repo, doc) and get a URL\n2. Click "Create" → "New Skill"\n3. Enter title, summary, the Skill URL, optional Support URL, target tool(s), and modality (text, code, image, video, audio, or multimodal — same idea as prompts)\n4. Choose visibility (Public / Team / Private) and save as Draft or Publish Now',
      },
      {
        question: "How do I rate a skill or add it to a collection?",
        answer:
          "Star ratings (1-5) and the bookmark-style Collection menu are available on every skill detail page and list card, exactly like prompts. You cannot rate your own skills.",
      },
    ],
  },
  {
    id: "context",
    title: "Context",
    articles: [
      {
        question: "What is context?",
        answer:
          "Context documents are reference materials that help AI tools understand your specific situation, rules, or domain knowledge — style guides, product documentation, company policies, technical references, or data dictionaries.",
      },
      {
        question: "When should I use context vs. a skill?",
        answer:
          "• Context — for information the AI should know about (facts, rules, documentation). You paste or reference it as background knowledge.\n• Skills — for behavioral instructions (how the AI should act, respond, or process inputs) delivered as an installable package.\n• Prompts — for a specific one-shot instruction you're issuing right now.",
      },
      {
        question: "How do I add context?",
        answer:
          '1. Click "Create" → "New Context"\n2. Paste or write your reference document in markdown\n3. Optionally add a Support URL — the detail page shows a documentation icon that links out to canonical docs\n4. Add variables if the context has fill-in fields, pick target tool(s), modality (text, code, image, etc.), and set visibility\n5. Save as Draft or Publish',
      },
      {
        question: "Can context documents have variables?",
        answer:
          "Yes. Just like prompts, Context documents support [KEY] and {{KEY}} placeholders. Define them in the editor and fill them in at use time on the detail page — the interpolated markdown is what gets copied.",
      },
      {
        question: "How do I rate context or add it to a collection?",
        answer:
          "Star ratings and the Collection menu are available on every context detail page and list card. Self-ratings are blocked.",
      },
    ],
  },
  {
    id: "builds",
    title: "Builds",
    articles: [
      {
        question: "What is a Build?",
        answer:
          'Builds are pre-built AI solutions — apps, agents, workflows, demos, or tools — that you can use, fork, or adapt. Unlike Prompts (instructions) or Skills (reusable capability packs), Builds are finished "solutions you can run." If someone built a working Agentforce demo, an internal Slack agent, or a Gemini-powered dashboard, publish it as a Build so others can pick it up.',
      },
      {
        question: "How do I find and use a Build?",
        answer:
          "Click the Builds card on the homepage hero, or pick the Builds filter chip in Smart Search. On a Build detail page:\n• Build URL — the live solution, repo, or deployment link\n• Support URL — optional docs / install guide\n• Engagement — favorite, rate, add to a collection, or share it\nClick the Build URL to open the solution in a new tab.",
      },
      {
        question: "How do I create a Build?",
        answer:
          '1. Click "Create" → "New Build"\n2. Add a title, summary, Build URL, optional Support URL, target tool(s), and modality (text, code, image, etc.)\n3. Set visibility (Public / Team / Private)\n4. Save as Draft or Publish\n\nBuilds support the same features as other asset types: versioning (with optional changelog notes on update), favorites, 1-5 star ratings, collection membership, sharing, thumbnails, archive, and permanent delete.',
      },
      {
        question: "Are Builds versioned?",
        answer:
          'Yes. Every update creates a new BuildVersion capturing title, summary, buildUrl, supportUrl, and an optional changelog note — just like prompt versioning. The full version history is visible on the detail page.',
      },
    ],
  },
  {
    id: "collections",
    title: "Collections",
    articles: [
      {
        question: "What are collections?",
        answer:
          "Collections are folders for organizing AI assets. Use them to group related Prompts, Skills, Context documents, and Builds by project, use case, campaign, or workflow.",
      },
      {
        question: "How do I create a collection?",
        answer:
          '1. Go to Collections in the navigation\n2. Enter a name and optional description\n3. Click "Create Collection"',
      },
      {
        question: "How do I add assets to a collection?",
        answer:
          "On any Prompt, Skill, Context, or Build detail page, click the bookmark icon in the action toolbar. A dropdown shows your collections — click any collection to add or remove the asset. You can also add members to a collection from the collection detail page so specific teammates see it in their view.",
      },
      {
        question: "What are System Collections?",
        answer:
          'System Collections are auto-curated collections that AI Library maintains for you:\n• One per supported tool (Slackbot, Agentforce Vibes, Claude, ChatGPT, Gemini, Cursor, Claude Cowork, NotebookLM, Saleo, Other) — auto-populated with matching assets\n• "Best of AI Library" — top performers by combined engagement\n\nSystem collections show a lock-style badge and cannot be edited or deleted by users. Admins can trigger a manual refresh from the admin controls.',
      },
      {
        question: "What asset types can I add to a collection?",
        answer:
          "All four: Prompts, Skills, Context Documents, and Builds. A single collection can mix types — for example, pair a code-review prompt with a code-review skill, a coding-standards context doc, and a Build that demonstrates the end-to-end flow.",
      },
    ],
  },
  {
    id: "ai-tools",
    title: "Using AI Tools",
    articles: [
      {
        question: "Which AI tools does AI Library support?",
        answer:
          "Supported target tools (selectable when creating or filtering assets):\n• Slackbot — Salesforce's AI assistant in Slack\n• Agentforce Vibes — Salesforce's vibe-coding IDE\n• Claude / Claude Cowork — Anthropic\n• ChatGPT — OpenAI\n• Gemini — Google\n• Cursor — AI-first code editor\n• NotebookLM — Google's research notebook\n• Saleo — demo-environment data platform\n• Other — for tools not yet in the list (submit a Tool Request to get it added)",
      },
      {
        question: 'How does "Use" / "Launch" work?',
        answer:
          'The green "Use" button copies the (fully interpolated) prompt to your clipboard and shows a toast confirmation. When a prompt is marked for a specific launch-capable tool (like Claude, Gemini, or ChatGPT), an additional launch button opens a new tab in that tool with the prompt pre-filled where possible. For tools without a direct deep-link, you\'ll need to paste the prompt manually.',
      },
      {
        question: "Can I use an AI Library prompt with any tool?",
        answer:
          "Yes. The copy button works universally — paste the prompt into any AI tool you prefer. The tool tags on each asset are a recommendation, not a restriction.",
      },
    ],
  },
  {
    id: "visibility-roles",
    title: "Visibility & Roles",
    articles: [
      {
        question: "What are the visibility levels?",
        answer:
          "Every asset (Prompt, Skill, Context, Build) has a visibility level:\n• Public — anyone signed into AI Library can see and use it (global; not scoped to your Department/OU)\n• Team — only members with the same Department/OU as the asset owner can see it (Region does not affect Team visibility)\n• Private — only you can see it\n\nAdmins can see all assets regardless of visibility.",
      },
      {
        question: "What user roles exist?",
        answer:
          '• ADMIN — full access, including admin tools and visibility into all assets\n• OWNER — team owner; full write access\n• MEMBER — standard writer; can create, edit, favorite, rate, and use all published assets\n• VIEWER — read-only; can browse, favorite, rate, and use assets but cannot create or edit anything. VIEWER is assigned automatically to @meshmesh.io accounts and can be set by an admin for any user.',
      },
      {
        question: 'Why don\'t I see a "Create" button?',
        answer:
          'You likely have the VIEWER role, which is read-only. If you believe this is a mistake, contact an admin in #help-ailibrary and ask them to promote your account to MEMBER.',
      },
    ],
  },
  {
    id: "search",
    title: "Search & Discovery",
    articles: [
      {
        question: "How does Smart Search work?",
        answer:
          'The search bar at the top of the homepage is a unified Smart Search. It supports:\n• Plain keyword and title search with relevance highlighting; the unified catalog ranks title matches ahead of body-only matches, and skills match install URL text as well as title and summary\n• Natural language with facet hints — e.g. "cursor prompts for code review" can parse into { tool: cursor, assetType: prompt, searchTerms: "code review" }; simple phrases without those hints are searched as-is\n• Auto-suggestions (categorized by asset and filter) that appear as you type; navigate with arrow keys\n• Removable filter chips showing the active filters\n• URL sync, debounced input, and ⌘K keyboard shortcut',
      },
      {
        question: "What are Faceted Filters?",
        answer:
          "Below the search bar you'll see a row of clickable filter chips with live result counts, grouped by asset type (Prompts, Skills, Context, Builds) and by tool. Click a chip to add or remove that filter — counts update as you refine the search.",
      },
      {
        question: "What is the \"Ask AI\" beta on the Help page?",
        answer:
          'At the top of this Help page, "Ask AI" lets you ask any question in plain language. We feed your question plus the help documentation to Gemini and return a concise answer. Use it when you\'re not sure where to look.',
      },
    ],
  },
  {
    id: "profile",
    title: "Your Profile",
    articles: [
      {
        question: "How do I update my profile?",
        answer:
          "Click your avatar in the top-right corner to open the profile modal, or go to /settings for the full-page version. You can update your display name, region, Department/OU, title, and profile photo.",
      },
      {
        question: "How do I change my profile photo?",
        answer:
          'In the profile modal or Settings page, click "Change Photo" to upload a new headshot. Supported formats: JPEG, PNG, GIF, WebP (max 5 MB). Uploads are stored on the server and served from /uploads/.',
      },
      {
        question: "What are Region and Department/OU?",
        answer:
          "Region is for reporting and administration only — it does not control who sees Team-visible assets. Department/OU (with an optional Other value) scopes My Team (TEAM) sharing: only users whose stored Department/OU string matches the asset owner's can see that asset when it is set to Team. Title is optional on profile save; Department/OU is required when completing onboarding.",
      },
    ],
  },
  {
    id: "my-content",
    title: "Your Content & Analytics",
    articles: [
      {
        question: "Where is My Content?",
        answer:
          'The homepage at "/?mine=true" is your full-featured My Content view. You can also get there from Settings → "My Content" or from your profile dropdown. It shows everything you\'ve created across Prompts, Skills, Context, and Builds.',
      },
      {
        question: "What can I do in the My Content view?",
        answer:
          '• Search within your own assets\n• Filter by Status (Draft, Published, Archived)\n• Sort by Recent, Most Used, Name, or Updated At\n• Toggle between card view and a compact List view (Name / Status / Edit columns)\n• Toggle "Show Analytics" to see inline view, use, rating, and favorite counts on every card\n• Paginate with Previous / Next',
      },
      {
        question: "Where can I see analytics for my content?",
        answer:
          'Go to Settings and click "My Analytics," or use "/?mine=true&showAnalytics=true". This shows a sortable analytics table with view counts, usage, ratings (count + average), and favorites for every Prompt, Skill, Context doc, and Build you\'ve created.',
      },
      {
        question: "What metrics are tracked for my content?",
        answer:
          "• Views — page views of the detail page\n• Uses — COPY + LAUNCH events only (VIEW events are excluded so this reflects real usage)\n• Ratings — count of ratings and average star rating\n• Favorites — how many people have saved the asset",
      },
      {
        question: "Can I export my analytics?",
        answer:
          'Yes — in the My Analytics table, click "Export CSV" to download a spreadsheet. Use the "Columns" dropdown first to hide any columns you don\'t want in the export; the filename includes today\'s date.',
      },
      {
        question: "Can I see who used my content?",
        answer:
          "No. For privacy, we only expose aggregate metrics — not individual users who viewed, used, rated, or favorited your assets.",
      },
    ],
  },
  {
    id: "api-keys-mcp",
    title: "API Keys & MCP Integration",
    articles: [
      {
        question: "What is MCP and why would I use it?",
        answer:
          'MCP (Model Context Protocol) lets AI tools — Cursor, Claude, and others — talk to AI Library directly. With the AI Library MCP server configured, you can say things like "MeshMesh, add this prompt to the AI Library" in Cursor and it\'ll be created for you, tagged against your account.',
      },
      {
        question: "How do I generate an API key?",
        answer:
          'Go to Settings → API Keys. Click "Generate new key" and give it a name. The full key (format: alib_xxx…) is shown once — copy it immediately. After that only the prefix is visible. You can set an optional expiration date and revoke keys any time.',
      },
      {
        question: "Which endpoints can an API key call?",
        answer:
          "API keys authenticate requests to /api/v1/* endpoints:\n• POST /api/v1/prompts — create a prompt\n• POST /api/v1/skills — create a skill\n• POST /api/v1/context — create a context document\n• POST /api/v1/builds — create a build\n• GET /api/v1/me — identity check\n\nPass the key as an Authorization: Bearer alib_xxx header.",
      },
      {
        question: "Which MCP tools are exposed?",
        answer:
          "The mcp-server package exposes: add_prompt, add_skill, add_context, add_build, and whoami. Install the @ailibrary/mcp-server package in your MCP-compatible client and set your API key — then the tools show up in your AI assistant's tool list.",
      },
      {
        question: "How are duplicates handled over the API?",
        answer:
          "Duplicate detection runs on every create and update across all four asset types. If your request would create a duplicate (identical body hash, 85%+ similar title, or duplicate normalized URL for Skills/Builds), the server returns HTTP 409 Conflict with the matched assets — the MCP client will surface this back to you.",
      },
    ],
  },
  {
    id: "duplicates",
    title: "Duplicate Detection",
    articles: [
      {
        question: "What gets flagged as a duplicate?",
        answer:
          "AI Library runs these checks on every create and update:\n• Exact body match — SHA-256 hash of normalized body text (lowercased, whitespace-collapsed). Applies to Prompts and Context.\n• Exact title match — normalized title comparison\n• Similar title — Levenshtein-distance fuzzy match at 85% or higher\n• Exact URL match — normalized Skill URL or Build URL duplicate\n\nWhen any of these match, the Duplicate Warning modal appears with links to the existing assets so you can review before continuing.",
      },
      {
        question: "Can I still create the asset if a duplicate is detected?",
        answer:
          "Yes — you can dismiss the warning if you\'re sure the new asset is meaningfully different (for example, a significant rewrite). The modal is informational, not blocking, except where a unique-constraint duplicate (like an identical body hash) must be resolved first.",
      },
    ],
  },
  {
    id: "compliance",
    title: "Compliance & Policies",
    articles: [
      {
        question: "What's the compliance modal that appears on load?",
        answer:
          "On first visit and every 96 hours afterward, AI Library shows a compliance acknowledgment modal. It reminds you to follow the Salesforce SAM Team policies and the Data Classification Policy when using AI tools and when uploading content here. You must choose:\n• I Understand — records acknowledgment in localStorage (key: promptlibrary.compliance.acknowledged) and dismisses the modal for 96 hours\n• Nope, get me out of here — redirects you to salesforce.com",
      },
      {
        question: "Where can I read the full policies?",
        answer:
          "The modal links out to the SAM Policy and the Data Classification Policy on Basecamp. Always check those sources for the authoritative language.",
      },
      {
        question: "What should I never upload?",
        answer:
          "Do not paste confidential customer data, regulated data (PII, PHI, payment data), or other restricted content into prompts, skills, context, or builds. If in doubt, keep it Private or ask in #help-ailibrary before publishing.",
      },
    ],
  },
  {
    id: "tips",
    title: "Tips & Best Practices",
    articles: [
      {
        question: "How do I write effective prompts?",
        answer:
          "• Be specific about what you want\n• Include the context the AI needs to know\n• Specify the format (bullet points, paragraph, code, JSON, etc.)\n• Use variables for anything that changes between uses\n• Test the prompt in your target tool before publishing",
      },
      {
        question: "How can I get more from AI tools?",
        answer:
          "• Load relevant skills into your AI tool's system instructions or custom-skill slot\n• Provide context documents for domain-specific work\n• Iterate on prompts — small wording changes can make big differences\n• Share what works so others can benefit",
      },
      {
        question: "How can I contribute to AI Library?",
        answer:
          "• Publish prompts and skills that have worked well for you\n• Rate assets you use so others know what's valuable\n• Create Context documents for knowledge that helps the AI understand your domain\n• Publish Builds when you've wired an end-to-end solution together\n• Report bugs and suggest features in #help-ailibrary",
      },
      {
        question: "I still need help — where do I go?",
        answer:
          'Use the "Get help in #help-ailibrary" button at the top of this page to post in the team Slack channel. You can also use the "Ask AI" box above for instant answers against this documentation.',
      },
    ],
  },
];

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ className, expanded }: { className?: string; expanded: boolean }) {
  return (
    <svg
      className={`${className} transition-transform ${expanded ? "rotate-90" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

type HelpArticleItemProps = {
  article: HelpArticle;
  searchQuery: string;
  defaultExpanded?: boolean;
};

function HelpArticleItem({ article, searchQuery, defaultExpanded = false }: HelpArticleItemProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-(--color-border) last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-(--color-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary) focus-visible:ring-inset"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <span className="font-medium">{highlightMatch(article.question, searchQuery)}</span>
        <ChevronIcon className="h-5 w-5 shrink-0 text-(--color-text-muted)" expanded={expanded} />
      </button>
      {expanded ? (
        <div className="px-4 pb-4 text-sm text-(--color-text-muted) whitespace-pre-line">
          {highlightMatch(article.answer, searchQuery)}
        </div>
      ) : null}
    </div>
  );
}

type HelpSectionCardProps = {
  section: HelpSection;
  searchQuery: string;
  expandAll?: boolean;
};

function HelpSectionCard({ section, searchQuery, expandAll = false }: HelpSectionCardProps) {
  return (
    <section id={section.id} className="rounded-xl border border-(--color-border) bg-(--color-surface) overflow-hidden">
      <h2 className="border-b border-(--color-border) bg-(--color-surface-muted) px-4 py-3 text-lg font-semibold">
        {section.title}
      </h2>
      <div>
        {section.articles.map((article, index) => (
          <HelpArticleItem
            key={index}
            article={article}
            searchQuery={searchQuery}
            defaultExpanded={expandAll}
          />
        ))}
      </div>
    </section>
  );
}

export function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredContent = useMemo(() => {
    if (!searchQuery.trim()) return helpContent;
    const query = searchQuery.toLowerCase();
    return helpContent
      .map((section) => ({
        ...section,
        articles: section.articles.filter(
          (article) =>
            article.question.toLowerCase().includes(query) || article.answer.toLowerCase().includes(query),
        ),
      }))
      .filter((section) => section.articles.length > 0);
  }, [searchQuery]);

  const hasResults = filteredContent.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Help</h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Everything you need to know about using AI Library.
          </p>
        </div>
        <a
          href="https://salesforce.enterprise.slack.com/archives/C0ATAP14WEQ"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-2 text-sm font-medium hover:bg-(--color-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
          </svg>
          <span>Get help in #help-ailibrary</span>
        </a>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="lg:sticky lg:top-8 lg:w-56 shrink-0">
          <nav className="rounded-xl border border-(--color-border) bg-(--color-surface) p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">Topics</p>
            <ul className="space-y-1">
              {helpContent.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block rounded-lg px-3 py-1.5 text-sm hover:bg-(--color-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="flex-1 space-y-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-(--color-text-muted)" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter help articles..."
              className="w-full rounded-xl border border-(--color-border) bg-(--color-surface) py-3 pl-10 pr-4 focus:border-(--color-primary) focus:outline-none focus:ring-2 focus:ring-(--color-primary)/20"
            />
          </div>

          {hasResults ? (
            filteredContent.map((section) => (
              <HelpSectionCard
                key={section.id}
                section={section}
                searchQuery={searchQuery}
                expandAll={searchQuery.trim().length > 0}
              />
            ))
          ) : (
            <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-8 text-center">
              <p className="text-(--color-text-muted)">
                No results found for "{searchQuery}". Try a different search term or ask AI above.
              </p>
              <button
                type="button"
                className="mt-3 text-sm text-(--color-primary) hover:underline"
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
