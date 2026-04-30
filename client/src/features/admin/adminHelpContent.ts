export type AdminHelpArticle = {
  question: string;
  answer: string;
};

export type AdminHelpSection = {
  id: string;
  title: string;
  articles: AdminHelpArticle[];
};

export const adminHelpContent: AdminHelpSection[] = [
  {
    id: "analytics",
    title: "Analytics Dashboard",
    articles: [
      {
        question: "What does the Analytics dashboard show?",
        answer:
          "/analytics (also reachable from Admin Dashboard → Analytics) shows team-scoped catalog insights plus two global rolling 7-day leaderboards (same definitions as the homepage):\n• Most Used AI Assets — single merged leaderboard for your workspace: prompts rank by COPY + LAUNCH; skills, context, and builds rank by COPY (passive views excluded). The top ten across all types are shown with deep links to each asset.\n• Top Rated — prompts only today: highest scoring average (unrated assets excluded from the list)\n• Stale — prompts with no usage events in the last 30 days (informational only)\n• Top Contributors This Week (global) — owners ranked by count of assets whose first publish (`publishedAt`) fell in the rolling last 7 days; any visibility; still PUBLISHED.\n• Engagement / Most Active This Week (global) — one point per qualifying event in the rolling last 7 days: first publish (owner), detail view, use (prompt COPY/LAUNCH; other types COPY), favorite, collection add (who added), new rating (rater; row created in the window).",
      },
      {
        question: "What counts as a Stale asset?",
        answer:
          "Stale lists assets with no usage events in the last 30 days. This is purely informational today — nothing auto-archives based on this list. Once the Asset Governance feature ships, the governance sweep will turn an equivalent signal (no usage AND no rating activity) into an INACTIVE auto-archive.",
      },
      {
        question: "How is Top Rated calculated today?",
        answer:
          "Today: simple average of 1-5 star ratings across users who are not the asset owner.\nAfter the governance/ratings plan ships: Bayesian-smoothed score that blends each asset's average with the team-wide average (weighted by rating count), then adjusted by feedback flag penalties (Didn't Work, Inaccurate, Outdated). Unverified or overdue assets will be filtered out.",
      },
      {
        question: "What is User Engagement?",
        answer:
          "The homepage (for signed-in users) and the Admin Analytics page both show two rolling 7-day leaderboards that are global across the deployment (not filtered to your team). Top Contributors ranks owners by how many assets reached PUBLISHED for the first time in the window (`publishedAt`). Most Active ranks users by summing one point each for: first-time publishes they own, asset detail views, uses (prompt copy/launch; copy on skills/context/builds), favorites they added, items they added to a collection, and new ratings they created (rating row `createdAt` in the window). The homepage also lists Top Assets This Week: PUBLIC PUBLISHED assets ranked by combined views + uses in the last 7 days.",
      },
    ],
  },
  {
    id: "tool-requests",
    title: "Tool Requests",
    articles: [
      {
        question: "How do I review a tool request?",
        answer:
          'Open /admin/tool-requests (or click the Tool Requests tile on the Admin Dashboard). Each request shows name, Salesforce-approved status, details URL, description, submitter, and current status. Click Review and choose Approve, Decline, or On Hold with optional notes. Approved tools appear in the create/edit pickers automatically.',
      },
      {
        question: "When should I put a request On Hold?",
        answer:
          "Use On Hold when the tool looks promising but needs clarification — missing approval, incomplete description, or pending security review. The requester can see the status and resubmit with updated details.",
      },
      {
        question: "What happens to declined requests?",
        answer:
          "Declined requests stay in the system with the decline reason you entered, but the tool is never added to the picker. The submitter can see the decision and notes.",
      },
    ],
  },
  {
    id: "system-collections",
    title: "System Collections",
    articles: [
      {
        question: "What are system collections?",
        answer:
          'Auto-curated collections that AI Library maintains: one per supported tool (Slackbot, Agentforce Vibes, Claude, ChatGPT, Gemini, Cursor, Claude Cowork, NotebookLM, Saleo, Other) plus "Best of AI Library" which surfaces top performers across all asset types. System collections carry an isSystem flag, show a lock-style badge in the UI, and can\'t be edited or deleted by users.',
      },
      {
        question: "When should I manually refresh them?",
        answer:
          "Use the Refresh now button on the Admin Dashboard → System Collections tile after:\n• A bulk seed or data import\n• A schema migration that changed tool tagging\n• Any manual mass-edit to asset tool tags\n\nFor normal day-to-day operation you rarely need to trigger this — the system keeps collections in sync when assets change status or tags.",
      },
      {
        question: "What powers Best of AI Library?",
        answer:
          "A combined score of usage events + favorites + average rating across all four asset types. Today that's a straight weighted sum; once the governance plan ships this will use the Bayesian-smoothed score with flag penalties and will exclude unverified/overdue assets.",
      },
    ],
  },
  {
    id: "admin-roles",
    title: "Admin Roles & Access",
    articles: [
      {
        question: "Which roles can access the Admin Dashboard?",
        answer:
          "ADMIN and OWNER roles. The AdminRoute guard redirects any other role to the homepage. VIEWER, MEMBER, and any unauthenticated user cannot see the Admin link in navigation or reach /admin directly.",
      },
      {
        question: "How do I promote a user to MEMBER or ADMIN?",
        answer:
          "Today, role changes happen via direct database update (see the User.role column). A role-management UI is on the roadmap. Until then, note the user's email and run the role-update SQL in production, or coordinate with another admin.",
      },
      {
        question: "Who sees what by visibility?",
        answer:
          "• PUBLIC — anyone signed into AI Library\n• TEAM — only members who share the same Department/OU string as the asset owner (Region does not apply)\n• PRIVATE — only the owner\n• ADMIN / OWNER — can see all assets regardless of visibility (useful for troubleshooting and curation)",
      },
    ],
  },
];
