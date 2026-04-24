export type ChangelogEntry = {
  version: string;
  date: string;
  changes: string[];
};

export const changelog: ChangelogEntry[] = [
  {
    version: "1.3.4",
    date: "2026-04-24",
    changes: [
      "Builds: creators can now upload their own thumbnail image at create time or any time later via edit, instead of the AI-generated thumbnail",
      "Build edit page adds an independent \"Upload image\" section with live preview, plus a \"Use AI-generated image instead\" button that calls the existing regenerate endpoint",
      "When a custom image is uploaded at creation, AI thumbnail generation is skipped entirely (no Gemini call, no cost)",
      "New POST /api/builds/:id/thumbnail endpoint (owner/admin only, 5 MB cap, JPEG/PNG/GIF/WebP) writes to server/public/uploads/ and replaces any prior uploaded file on overwrite",
      "Custom image upload is scoped only to Builds — Prompts, Skills, and Context Documents are unchanged",
    ],
  },
  {
    version: "1.3.3",
    date: "2026-04-24",
    changes: [
      "New Admin Dashboard (/admin) consolidates all admin tools (Analytics, Tool Requests, System Collections) behind a single entry point with a live pending-tool-requests badge",
      "Admin-only Help page (/admin/help) with a dedicated knowledge base covering analytics, tool request review, system collections, and admin roles — separate from the user-facing Help",
      "Top-nav consolidated: the old Analytics and Tool Requests nav links are replaced by a single Admin link",
      "Placeholders on the dashboard for upcoming Asset Governance and Ownership Transfer tools so admins know what is coming",
      "Admin-specific content scrubbed from the user-facing Help page and the Ask AI knowledge base so general users no longer see admin URLs or workflows",
    ],
  },
  {
    version: "1.3.2",
    date: "2026-04-24",
    changes: [
      "Branded transactional email template with site header/footer, mobile-responsive layout, and dark-mode support",
      "New sendBrandedEmail helper is now the required API for every outgoing email",
      "Tool-request admin notification rebuilt on the branded template with a preheader and pill CTA",
      "New workspace rule mandates sendBrandedEmail for all current and future outgoing email",
      "Slackbot skills importer script migrates legacy slackbot-tagged Prompts into URL-based Skills (dry-run by default)",
      "Initial slackbot skills seed CSV (117 rows) added for the importer",
    ],
  },
  {
    version: "1.3.1",
    date: "2026-04-24",
    changes: [
      "OU taxonomy refreshed to the 2026 canonical list (AMER TMT & CBS, AMER REG, AMER PACE & AFD360 OU, Global SMB (incl. EBOU), UKI (incl. PE), EMEA Central/North/South, France, LATAM, ANZ, North Asia, South Asia, GPS .Org, Data Foundation)",
      "OU dropdown options extracted into a single shared constant (client/src/constants/ous.ts) used by both the onboarding modal and Settings page",
      "One-time data migration remaps legacy OU values (e.g. GLOBAL SMB → Global SMB (incl. EBOU), NEXTGEN PLATFORM → Data Foundation, AMER ACC → AMER TMT & CBS)",
      "Users previously assigned to JAPAN / KOREA / TAIWAN are prompted to re-select an OU on their next action",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-04-23",
    changes: [
      "Comprehensive Help page rewrite covering Builds, URL-based Skills, Visibility & Roles, API Keys & MCP, Smart Search, Duplicate Detection, Compliance, and Admin workflows",
      "Help AI (Ask AI beta) knowledge base updated with the full v1.3 feature set so answers reflect current behavior",
      "Teams / OU sharing fix: PUBLIC visibility is now truly global and TEAM is locked to the creator's OU; admins can still see all",
      "Hide rate-stars on list cards for assets you own and block self-rating across all asset types",
      "Agentforce Vibes added as a supported target tool",
      "Builds homepage card copy refined (\"demos\" → \"solutions\")",
      "Production URL pinned to https://ail.mysalesforcedemo.com in summary and rules",
      "Additional Slackbot prompt seed script added for bulk SE/AE content imports",
      "Prompts list page: removed the duplicate Create Prompt button in favor of the unified header Create menu",
    ],
  },
  {
    version: "1.25.0",
    date: "2026-04-23",
    changes: [
      "Asset Deduplication: prevents duplicate asset creation with fuzzy title matching and content hashing",
      "Duplicate detection for all asset types (Prompts, Skills, Context, Builds)",
      "User-friendly duplicate warning modal with match type badges and links to existing assets",
      "85% similarity threshold for fuzzy title matching using Levenshtein distance",
      "SHA-256 content hashing for exact body duplicate detection",
      "URL normalization for Skills and Builds to prevent duplicate URLs",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-04-23",
    changes: [
      "Builds: new asset type for sharing pre-built solutions and tools, with full CRUD, favorites, ratings, usage events, and collection membership",
      "Versioning for Builds, Skills, and Context (matching existing Prompt versioning)",
      "Builds integrated into unified assets API, search, facets, and homepage navigation",
      "API Keys and MCP integration: programmatic content creation from Cursor and other MCP clients",
      "Skills migrated to URL-based format (matching Builds pattern)",
      "Top Performers redesigned on homepage with single query, de-duplication, and expandable 'Show more'",
      "Compliance modal requiring SAM Team policy acknowledgment every 96 hours",
      "Documentation icon/link added to Context detail pages when supportUrl is set",
      "Dev whitelist bypass token for automated testing of authenticated endpoints",
      "Filter dropdown dark-mode styling fixes and improved color-scheme handling",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-04-23",
    changes: [
      "Official 1.0 release - AI Library is ready for production use!",
      "Added VIEWER role for read-only access (ideal for external partners)",
      "Collection user membership - add users to collections",
      "Improved thumbnail generation with automatic retry and exponential backoff",
      "Comprehensive access control across all create/edit/delete operations",
    ],
  },
  {
    version: "0.5.6",
    date: "2026-04-16",
    changes: [
      "Added version number display in footer",
      "Introduced changelog page to track updates",
    ],
  },
  {
    version: "0.5.5",
    date: "2026-04-15",
    changes: [
      "Improved help page with AI-powered search",
      "Admin improvements",
    ],
  },
  {
    version: "0.5.4",
    date: "2026-04-10",
    changes: [
      "Added Skills feature for reusable AI instructions",
      "Added Context feature for reference documents",
      "Improved prompt editor with variable support",
    ],
  },
  {
    version: "0.5.3",
    date: "2026-04-05",
    changes: [
      "Added Collections to organize your saved content",
      "Improved search and filtering across all content types",
    ],
  },
  {
    version: "0.5.2",
    date: "2026-04-01",
    changes: [
      "Added profile photo upload",
      "Improved onboarding experience",
      "Performance improvements",
    ],
  },
  {
    version: "0.5.1",
    date: "2026-03-28",
    changes: [
      "Added dark mode support",
      "Improved mobile responsiveness",
    ],
  },
  {
    version: "0.5.0",
    date: "2026-03-25",
    changes: [
      "Initial beta release",
      "Prompt library with create, edit, and share functionality",
      "Google SSO authentication",
      "Rating and favorites system",
    ],
  },
];
