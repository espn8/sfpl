export type ChangelogEntry = {
  version: string;
  date: string;
  changes: string[];
};

export const changelog: ChangelogEntry[] = [
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
