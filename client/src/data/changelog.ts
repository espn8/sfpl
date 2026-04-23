export type ChangelogEntry = {
  version: string;
  date: string;
  changes: string[];
};

export const changelog: ChangelogEntry[] = [
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
