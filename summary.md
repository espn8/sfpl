# AI Library - Technical Summary

Last Updated: Monday, April 20, 2026 — 16:15 CDT
Build Version: 2cc69d5

## Recent Changes

- **Publish/Draft status modal for new assets**: Added a modal dialog that prompts users to choose between "Draft" and "Published" status when creating a new asset (Prompt, Skill, or Context Document). Previously, the status dropdown was pre-filled with "DRAFT" and users could change it, but there was no explicit prompt asking them to make a deliberate choice. Now when users click Create/Save on a new asset:
  - The form validates as before
  - A modal appears with two card-style options: "Save as Draft" (amber icon) or "Publish Now" (green icon)
  - User makes their choice, and the asset is created with that status
  - Cancel or Escape closes the modal without creating the asset
  - Created new reusable `PublishStatusModal` component in `client/src/components/PublishStatusModal.tsx`
  - Removed status dropdown from all three editor pages (PromptEditorPage, SkillEditorPage, ContextEditorPage) and integrated the modal

### Previous Session Changes (April 20, 2026)

- **Skill detail page React hooks fix**: Fixed React Error #310 ("Rendered fewer hooks than expected") that caused a blank page when viewing skill detail pages. The `useMemo` hook was being called after conditional early returns, violating React's Rules of Hooks. Moved `useMemo` before all conditional returns to ensure hooks are called in the same order on every render. This is the same fix pattern previously applied to ContextDetailPage.

- **Thumbnail generation for Skills and Context**: Extended thumbnail generation (previously only for Prompts) to Skills and Context documents:
  - Added `thumbnailUrl`, `thumbnailStatus`, `thumbnailError` fields to Skill and ContextDocument database models
  - Thumbnails are automatically generated when creating new Skills/Context using the Gemini image API
  - Added regenerate-thumbnail API endpoints for both asset types
  - AssetCard now displays thumbnails for all asset types
  - Skill and Context detail pages show thumbnails with regenerate button for owners/admins

- **Context detail page React hooks fix**: Fixed React Error #310 ("Rendered more hooks than during the previous render") that caused a blank page after creating a new context asset. The `useMemo` hook was being called after conditional early returns, violating React's Rules of Hooks. Moved `useMemo` before all conditional returns to ensure hooks are called in the same order on every render.

- **Profile save validation fix**: Fixed "Unable to save your profile" error that occurred when users attempted to save their profile without filling in all optional fields (region, OU, title). The server-side validation schema was requiring all fields to be non-empty, but existing users often had null values for these fields added later. Changed server validation to make `region`, `ou`, and `title` fields optional with empty string defaults. Updated client-side validation to only require name and profile photo.

- **Test fix**: Updated `useSearchState.test.tsx` to include the `status` field in expected default filters object.

### Previous Session Changes (April 17, 2026)

- **Sort option type alignment fix**: Removed `"topRated"` from all sort-related types to align with the UI which no longer offers this option:
  - `SortOption` type in `types.ts`
  - `isValidSort()` validator in `useSearchState.ts`
  - `ListPromptsFilters["sort"]` in `prompts/api.ts`
  - Sort mapping logic in `PromptsListPage.tsx`
  
  Previously, selecting "Top rated" would silently fall back to "recent" without user indication.

- **Home link navigation fix**: Clicking the "AI Library" logo in the header now properly resets the page to its default state by using `useNavigate("/")` instead of a simple Link, ensuring URL search params (like `?mine=true`) are cleared.

- **Sort option cleanup**: Removed unsupported "Top rated" sort option from SearchBar dropdown since it wasn't implemented in the backend API.

- **Unified My Content Page**: Complete redesign of the "My Content" experience with enhanced filtering and sorting capabilities.
  - **Dedicated My Content section**: Accessing `/?mine=true` now shows a full-featured content management interface with search, filters, and pagination.
  - **Status filtering**: Filter assets by status (Draft, Published, Archived) with new `showStatus` prop on SearchBar and backend support.
  - **Extended sort options**: Added "Name" (alphabetical) and "Updated At" sort options in addition to existing "Recent" and "Most Used".
  - **Unified settings link**: Settings page "Your Content" section now has a single "My Content" link instead of separate links per asset type.
  - **SearchEmptyState improvements**: Better empty state messaging for filtered vs unfiltered results with CTAs to create new assets.
  - **Pagination controls**: Full Previous/Next pagination in My Content view with page count display.
  - **API enhancements**: Assets API now supports `status` filter parameter and `name`/`updatedAt` sort options.

- **Collections API fix**: Fixed response parsing in `listCollections()` to correctly extract the data array from the API response structure.

### Previous Session Changes (April 17, 2026)

- **Smart AI Search System**: Comprehensive search overhaul with unified search bar, natural language parsing, auto-suggestions, and relevance highlighting.
  - **Unified SearchBar component**: Single search input with removable filter chips, keyboard shortcut (⌘K), debounced input (300ms), and URL state sync.
  - **Auto-suggestions dropdown**: Categorized suggestions showing matching assets and filter shortcuts with full keyboard navigation (arrow keys, Enter, Escape).
  - **Natural language query parsing**: Gemini-powered parser that converts queries like "cursor prompts for code review" into structured filters (tool: cursor, assetType: prompt, searchTerms: "code review"). Local parsing with fallback to AI for complex queries.
  - **Relevance highlighting**: Search terms highlighted in titles and summaries using `highlightMatches()` and `truncateWithHighlight()` utilities.
  - **Faceted filters**: Clickable result counts per asset type and tool displayed below search bar. Counts update dynamically with search results.
  - **SearchEmptyState component**: Helpful empty states for no results, no assets, and error conditions with clear CTAs.
  - **New API endpoints**: `GET /api/search/suggestions` (asset/filter suggestions), `GET /api/search/parse` (NL query parsing).
  - **Backend facet counts**: Assets API now returns `meta.facets` with counts by `assetType` and `tool`.

### Previous Session Changes (April 17, 2026 — earlier)

- **Unified HomePage with Asset Cards**: Refactored the homepage to display all asset types (Prompts, Skills, Context) in a unified view. New `HomePage.tsx` component with hero section, "Top Performers This Week" featured assets, "How AI Library Works" steps, tool integration cards, and optional admin leaderboards.
- **New Assets API**: Added `/api/assets` endpoint that returns unified paginated list of all asset types with filtering by type, tool, search, and sort options. Includes snapshot stats (assetsPublished, activeUsers, promptsUsed).
- **AssetCard component**: New unified card component (`AssetCard.tsx`) that renders prompts, skills, and context documents with consistent styling, actions (share, favorite, copy), and analytics display.
- **Refactored list pages**: Simplified `PromptsListPage`, `SkillListPage`, and `ContextListPage` to use dedicated card components (`PromptListCard`, `SkillListCard`, `ContextListCard`) with cleaner filter UIs.
- **Skills/Context usage tracking**: Added `logSkillUsage` and `logContextUsage` API functions for COPY event tracking from list cards.
- **Test fixes**: Updated pagination test to expect `promptsUsed` instead of `promptsViewed`, fixed collections test with `isSystem` field, updated AppShell test for new UI text, added missing mock exports to PromptEditPage test.
- **Production-only workflow rule**: Added `.cursor/rules/production-only-workflow.mdc` to enforce testing directly in production rather than local dev servers.

### Previous Session Changes (April 17, 2026)

- **Explore results hidden by default**: The prompt list cards below the "Explore AI Assets" filter section now only appear after the user applies at least one filter (search text, tag, tool, modality, or collection). This reduces visual clutter on the homepage and encourages users to actively search/filter for content.
- **Hero card icon color consistency**: Updated Prompts, Skills, and Context navigation card icons to use `text-(--color-text)` instead of `text-(--color-primary)`, matching the style of the HeroStatIcon components in the stats section below.
- **New tool options: ChatGPT and Claude Cowork**: Added `chatgpt` and `claude_cowork` to the tool options across all asset types (Prompts, Skills, Context Documents). Updated tool labels, launch provider logic, system collections, and legacy model hint mapping.
- **Usage metrics refactored to COPY/LAUNCH only**: Changed "AI Assets Viewed" metric to "AI Assets Used" — now counts only COPY and LAUNCH events, not VIEW events. This provides a more accurate measure of actual asset usage. Updated hero stats, prompt list cards, analytics overview, and OU analytics endpoints.
- **Toast notification system**: Added new `ToastProvider` context with `useToast` hook for showing success/error/info toast notifications. Integrated into app providers and used for copy confirmation feedback.
- **Copy button redesign on prompt cards**: Moved copy button from left action toolbar to right side next to launch button. Restyled with Salesforce purple (#5A1BA9) background, rounded-xl styling, and "Copy" label. Now shows toast confirmation on copy.
- **Multiple tool chips support**: Prompt cards now display chips for all selected tools instead of just the first one. Updated `toolChipsFromPrompt` to return array of labels.
- **Hero navigation cards with SVG icons**: Replaced emoji icons (📝, ⚡, 📄) with proper SVG stroke icons for Prompts, Skills, and Context cards on the homepage.
- **Context Document tools migration**: Added database migration to add `tools` column to ContextDocument table (existing rows default to empty array).
- **Test and deploy rule**: Added workspace rule for production deployment workflow including schema migration reminders.

### Previous Session Changes (April 17, 2026)

- **Improved error messages for create operations**: Updated `PromptEditorPage`, `SkillEditorPage`, and `ContextEditorPage` to display actual server error messages instead of generic "Could not create..." messages. Added `onError` handlers that log errors to console for debugging. When creation fails, users now see the real error (e.g., "Authentication required." if not logged in, or validation details if fields are invalid).

- **Mutation handler cleanup**: Converted async `onSuccess` handlers in mutation hooks to properly await `invalidateQueries` calls before navigation. Removed unnecessary `void` prefixes from `navigate()` calls in `CollectionDetailPage`, `ContextDetailPage`, `PromptDetailPage`, and `SkillDetailPage`. Fixed PromptDetailPage to navigate to `/` after deletion instead of `/prompts`.
- **Collections page loading states**: Added loading, error, and empty state handling to `CollectionsPage`. Displays "Loading collections..." during fetch, error message with refresh prompt on failure, and helpful empty state message when no collections exist.
- **Changelog page redesign**: Redesigned `ChangelogPage` to group entries by date with collapsible sections. Added chevron icons for expand/collapse, entry and change counts per date group, and improved visual hierarchy. Uses `useMemo` for efficient date grouping.

### Previous Session Changes (April 17, 2026)

- **Copy button redesign**: Moved the Copy button from the left action toolbar to the right side, placing it next to the "Use prompt" button. Updated styling to match the launch button (rounded-xl, px-4 py-2.5, text-sm font-semibold, shadow-sm) with Salesforce purple background (#5A1BA9) and added "Copy" text label for improved clarity.

- **Thumbnail regenerate button fix**: Fixed the "Regenerate me" text on failed prompt thumbnails to be an actual clickable button. Added `onRegenerate` and `isRegenerating` props to `PromptThumbnail` component. The regenerate button now appears for users with edit permissions (admins, owners, prompt authors) when thumbnail generation has failed. Calls `POST /api/prompts/:id/regenerate-thumbnail` endpoint.
- **Permanent asset deletion**: Users can now permanently delete their own created Prompts, Skills, and Context Documents. Added `ConfirmDeleteModal` component with clear warning that deletion cannot be undone and all analytics will be lost. Backend endpoints cascade-delete all related data (usage events, ratings, favorites, tags, variables, versions, collection memberships). Only the asset owner can permanently delete (not admins).
- **Delete button styling**: Added red "Delete" button to detail pages for asset owners. Archive button now uses amber/yellow styling to differentiate from the more destructive delete action.
- **New API endpoints**: `DELETE /api/prompts/:id/permanent`, `DELETE /api/skills/:id/permanent`, `DELETE /api/context/:id/permanent` for permanent asset removal with full cascade.

### Previous Session Changes (April 16, 2026)

- **Image generation config fix**: Added `responseModalities: ["IMAGE"]` to Gemini API request config in `nanoBanana.ts` to explicitly request image output, fixing thumbnail generation reliability.

- **Template variables for Skills and Context**: Extended the variable system from Prompts to Skills and Context Documents. Users can define `[KEY]` and `{{KEY}}` placeholders with labels, default values, and required flags. Added `SkillVariable` and `ContextVariable` Prisma models with full CRUD support.
- **Variable interpolation system**: Created centralized `client/src/lib/interpolate.ts` module with `interpolateBody()` function for placeholder replacement. Refactored `interpolatePrompt.ts` to use shared utility.
- **VariableEditor component**: New reusable `client/src/components/VariableEditor.tsx` for managing template variables across all asset types with add/edit/remove/insert functionality.
- **VariableInputs component**: New `client/src/components/VariableInputs.tsx` for runtime variable value entry on detail pages.
- **Skills/Context favorites**: Added `SkillFavorite` and `ContextFavorite` Prisma models with toggle endpoints (`POST /api/skills/:id/favorite`, `POST /api/context/:id/favorite`) and UI integration on detail pages.
- **Variables API endpoints**: Added `PUT /api/skills/:id/variables` and `PUT /api/context/:id/variables` for bulk variable replacement.
- **Editor pages variable support**: Updated `SkillEditorPage`, `SkillEditPage`, `ContextEditorPage`, and `ContextEditPage` to include VariableEditor with insert-to-body functionality.
- **Detail pages variable support**: Updated `SkillDetailPage` and `ContextDetailPage` to display variable inputs, interpolate body content, and show favorite toggle with count.
- **Changelog system**: Added `/changelog` route with `ChangelogPage` component displaying version history. Created `client/src/data/changelog.ts` data file with structured version entries.
- **Version bump automation**: Added `scripts/version-bump.js` for automatic patch version increment during Heroku builds. Syncs version across root, client, and server `package.json` files.
- **Footer version display**: AppShell footer now displays current app version with link to changelog page.
- **Vite environment injection**: Added `VITE_APP_VERSION` environment variable injection from `package.json` version during build.
- **Gemini model update**: Updated `nanoBanana.ts` to use `gemini-2.5-flash-image` model for thumbnail generation.
- **Help search refinements**: Minor improvements to help search service.

### Previous Session Changes (carried forward from April 16)

- **Tool Request System**: Added complete tool request submission and admin review workflow. Users can request new tools via a modal form accessible from prompt editor pages. Requests capture tool name, Salesforce approval status, details URL, and description. Admins can review, approve, decline, or put requests on hold via a dedicated admin page.
- **ToolRequest data model**: Added `ToolRequest` Prisma model with fields for submission data (name, salesforceApproved, detailsUrl, description, submitter info), review state (status, reviewedAt, reviewedById, reviewNotes), and timestamps. Added `ToolRequestStatus` enum (PENDING, APPROVED, DECLINED, ON_HOLD).
- **Tool Requests API**: New `/api/tool-requests` endpoints: `GET /approved-tools` (public, returns approved tool names), `POST /` (create request), `GET /` (admin list with filters/pagination), `PATCH /:id` (admin review).
- **Title sanitization utility**: Added `sanitizeTitle()` helper in `client/src/lib/sanitizeTitle.ts` that strips common asset type words (prompt, skill, context, rule, document, doc, file) from user-entered titles. Applied to all editor pages to prevent redundant naming like "My Prompt Prompt".
- **Asset type badges on detail pages**: Added `[Prompt]`, `[Skill]`, and `[Context]` suffix badges to detail page titles for clearer asset type identification.
- **Edit button visibility fix**: PromptDetailPage now only shows the Edit button when the current user has edit permissions (owner, admin, or content author).
- **TEAM visibility level**: Added new `TEAM` visibility option to Prompts, Skills, and Context Documents with OU-based access control.
- **Profile photo upload feature**: Added ability for users to upload custom profile photos via `POST /api/auth/me/profile-photo`.

### Earlier Session Changes

- **Settings link moved to user menu**: Moved Settings link from main navigation bar to user profile modal for cleaner navigation. Profile modal now includes Quick Links section with My Content, My Analytics, and Settings buttons.
- **Personalized hero greeting**: Homepage hero section now displays personalized greeting using user's first name. First-time visitors see "Your AI Awesomeness Starts Here, {firstName}!" and returning visitors see "Welcome Back to AI Awesomeness, {firstName}!". Uses localStorage to track first visit state. Falls back to generic "Your AI Advantage Starts Here" when user data is loading.
- **Hero navigation cards**: Added three navigation cards to homepage hero section providing quick access to Prompts, Skills, and Context sections with descriptions of each asset type and hover effects.
- **Dedicated Settings page**: Created full-page `/settings` route with organized sections for "Your Content" (My Prompts, My Skills, My Context) and "Your Analytics" (performance metrics for created assets). Migrated profile editing from modal to dedicated page UX with improved layout.
- **System Collections**: Introduced automatic tool-based and "Best of AI Library" collections. Added `systemCollections.ts` service with `ensureSystemCollections()`, `refreshToolCollection()`, `refreshBestOfCollection()`, and related utilities. Collections auto-populate with matching prompts based on tool tags or top performance metrics.
- **Collection system protections**: Added `isSystem` flag to Collection model. System collections cannot be modified or deleted by users. PATCH/DELETE endpoints now check `isSystem` and return 403 for protected collections.
- **Collections refresh endpoint**: Added `POST /api/collections/system/refresh` (admin-only) to manually trigger system collection refresh for tool-specific, best-of, or all system collections.
- **Automatic collection refresh**: Prompt create/update/delete operations now trigger async system collection refresh when status or tools change.
- **Help page AI search**: Added "Ask AI" beta feature to Help page with server-side AI-powered question answering via `/api/help/search` endpoint. Enhanced help content with "Your Content & Analytics" topic explaining Settings page features.
- **PromptListCard analytics**: Added `showAnalytics` prop to display view count, usage stats, ratings, and favorites inline when viewing "My Content" with analytics mode enabled.
- **Seed script enhancements**: Updated `seed.ts` to create system collections during database seeding via `ensureSystemCollections()`.
- **Expanded tool options**: Added "Saleo" and "Other" to `PROMPT_TOOL_OPTIONS` enum on both client and server.
- **Centralized tool labels**: Created `PROMPT_TOOL_LABELS` dictionary and utilities for human-readable tool names.
- **Tool selector UX overhaul**: Multi-select checkbox UI with conditional "Other" text input.
- **Terminology refinement**: Renamed "Modality" to "Generated output type" across UI and help documentation.
- **Markdown download button**: Added markdown export for Skills and Context detail pages.
- **Header branding refinement**: Changed header title from "SF AI Library" to "AI Library".
- **Comprehensive copy rewrite**: Salesforce voice across all user-facing content.
- **Searchable Help page**: Created `/help` route with indexed help content organized by topic.

## Audit Summary

The application has achieved **substantial completion** of the core implementation spec with significant improvements deployed in recent sessions. The original prompt-focused design has been extended to include Skills and Context Documents with enhanced usability features.

### Implementation Status Overview

| Component | Status |
|-----------|--------|
| Authentication (Google SSO, sessions, team scoping) | ✅ Complete |
| Prisma Data Model (all spec models + Skill/ContextDocument + usage events) | ✅ Complete |
| Prompt APIs (CRUD, versions, engagement, thumbnails) | ✅ Complete |
| Skills APIs (CRUD, list, search, usage tracking, permanent delete) | ✅ Complete |
| Context Documents APIs (CRUD, list, search, usage tracking, permanent delete) | ✅ Complete |
| Tags, Collections, Analytics APIs | ✅ Complete |
| System Collections (tool-based, best-of) | ✅ Complete |
| Frontend Routes (all spec routes + Skills/Context + Help + Settings) | ✅ Complete |
| Theme System (dark/light/system, persistence) | ✅ Complete |
| Share Functionality | ✅ Complete (Prompts, Skills, Context, Collections) |
| Analytics Dashboard UI | ✅ Complete (Top Used, Top Rated, Stale, Contributors, User Engagement) |
| Dedicated Settings Page | ✅ Complete (profile editing, my content, my analytics) |
| Quick-Create Actions | ✅ Complete (New Prompt/Skill/Context dropdown) |
| Skills/Context Feature Parity | ⚠️ Partial (no versioning, tags, favorites, ratings) |
| Help Documentation | ✅ Complete (searchable, indexed by topic, AI search beta) |
| Salesforce Brand Voice | ✅ Complete (individual-focused, action-oriented) |

### Identified Gaps (Prioritized)

1. **Feature Parity**: Skills/Context missing versioning, tags, collections, favorites, ratings.

### Remediation Roadmap (Updated)

| Phase | Description | Scope |
|-------|-------------|-------|
| 1 | Feature Parity for Skills/Context | Tags, Ratings, Versioning (lower priority) |

## Technical Architecture

### Core Stack

- Backend runtime: Node.js 20+
- Backend framework: Express `^5.2.1`
- Backend language: TypeScript `^5.9.3`
- Validation: Zod `^4.3.6`
- Database/ORM: PostgreSQL + Prisma (`@prisma/client` `^6.19.3`, `prisma` `^6.19.3`)
- Session/auth infra: `express-session` `^1.19.0`, `connect-pg-simple` `^10.0.0`, `jose` `^6.2.2`
- Data/HTTP utilities: `pg` `^8.20.0`, `cors` `^2.8.6`, `cookie-parser` `^1.4.7`, `multer` `^2.1.1`
- Frontend framework: React `^19.2.4`
- Frontend tooling: Vite `^8.0.1`, TypeScript `~5.9.3`, Tailwind CSS `^4.2.2`
- Frontend data/routing: TanStack Query `^5.95.2`, React Router DOM `^7.13.2`, Axios `^1.14.0`
- Test stack: Vitest (server `^4.1.2`, client `^3.2.4`), Supertest `^7.2.2`, Testing Library/JSDOM

### Runtime and System Requirements

- Node.js 20+
- npm 9+
- PostgreSQL (local or Heroku Postgres)
- Heroku CLI (deploy + operational commands)
- Google OAuth credentials for login
- Google Generative Language API key for thumbnail generation

### Third-Party APIs / Webhooks

- Google OAuth 2.0 / OIDC
  - Role: authenticate users and mint/verify session identity
  - Implementation: `server/src/routes/auth.ts`
- Google JWKS endpoint (`https://www.googleapis.com/oauth2/v3/certs`)
  - Role: verify Google ID token signatures
  - Implementation: `server/src/routes/auth.ts`
- Google Generative Language API (`https://generativelanguage.googleapis.com`)
  - Role: generate prompt card thumbnails via model `gemini-2.5-flash-image`
  - Implementation: `server/src/services/nanoBanana.ts`, `server/src/routes/prompts.ts`
- Heroku + Heroku Postgres
  - Role: runtime hosting + managed relational datastore
  - Implementation references: `Procfile`, `app.json`, `server/prisma/schema.prisma`
- GitHub Actions CI
  - Role: branch and PR quality checks
  - Implementation: `.github/workflows/ci.yml`

## Project Blueprint

### Directory Layout (commented)

```text
.
├── client/                                     # React + Vite frontend
│   ├── public/                                 # Vite static assets (salesforce-logo.png, favicon.ico)
│   ├── src/
│   │   ├── app/
│   │   │   ├── providers/ThemeProvider.tsx    # Theme state + persisted/system mode bootstrap
│   │   │   ├── router.tsx                      # Authenticated route graph
│   │   │   └── analytics.ts                    # GA4 page view tracking
│   │   ├── assets/                             # Bundled static assets
│   │   ├── components/                         # Shared UI shell/chrome (AppShell, ProtectedRoute, AdminRoute)
│   │   ├── features/
│   │   │   ├── prompts/                        # Discovery/detail/create/edit, cards, filters, interpolation, external launch, share, ToolRequestModal
│   │   │   ├── skills/                         # Skill list/detail/create/edit (markdown body, copy, share, usage tracking)
│   │   │   ├── context/                        # Context (markdown) list/detail/create/edit (copy, share, usage tracking)
│   │   │   ├── search/                         # Smart AI search (SearchBar, FilterChip, SearchSuggestions, FacetedFilters, SearchEmptyState, useSearchState hook, highlight utils)
│   │   │   ├── analytics/                      # Admin analytics dashboard (top used/rated, contributors, user engagement)
│   │   │   ├── collections/                    # Collection CRUD + membership surfaces + share
│   │   │   ├── admin/                          # Admin pages: ToolRequestsPage for tool submission review
│   │   │   ├── help/                           # Searchable help documentation (HelpPage.tsx)
│   │   │   └── auth/                           # OAuth entry + role helpers (LoginPage, api, roles)
│   │   ├── pages/                              # Static pages (TermsPage, PrivacyPage)
│   │   ├── styles/                             # Design tokens + theme semantics
│   │   └── main.tsx                            # Bootstrap + providers
├── server/                                     # Express + Prisma backend
│   ├── prisma/
│   │   ├── schema.prisma                       # Canonical data model (17 models, 7 enums)
│   │   ├── migrations/                         # Applied schema migrations
│   │   └── seed.ts                             # Demo data generation/reset
│   ├── src/
│   │   ├── app.ts                              # Middleware + routes + SPA static hosting
│   │   ├── index.ts                            # Server entry point
│   │   ├── config/env.ts                       # Environment validation
│   │   ├── lib/                                # prisma singleton, auth helpers
│   │   ├── middleware/                         # auth, errorHandler
│   │   ├── routes/
│   │   │   ├── prompts.ts                      # Prompt CRUD/search/rating/usage/favorites/thumbnail orchestration
│   │   │   ├── skills.ts                       # Skill CRUD + list search + usage tracking (team-scoped)
│   │   │   ├── context.ts                      # Context document CRUD + list search + usage tracking (team-scoped)
│   │   │   ├── search.ts                       # Smart search: suggestions endpoint and NL query parsing
│   │   │   ├── analytics.ts                    # Top-used/stale/contributors/user-engagement scoreboard
│   │   │   ├── collections.ts                  # Collection operations
│   │   │   ├── tags.ts                         # Tag management
│   │   │   ├── help.ts                         # Help search endpoint
│   │   │   ├── toolRequests.ts                 # Tool request submission and admin review
│   │   │   └── auth.ts                         # Google OAuth + session lifecycle
│   │   ├── services/
│   │   │   ├── nanoBanana.ts                   # Image generation adapter (Gemini API)
│   │   │   ├── helpSearch.ts                   # Help content search service
│   │   │   ├── searchParser.ts                 # Natural language query parsing (Gemini + local heuristics)
│   │   │   └── email.ts                        # Tool request email notifications
│   │   ├── lib/
│   │   │   ├── prisma.ts                       # Prisma singleton client
│   │   │   ├── auth.ts                         # Session/token helpers
│   │   │   └── email.ts                        # Nodemailer SMTP email client
│   └── test/                                   # API behavior tests
├── Procfile                                    # Heroku process model
├── app.json                                    # Heroku app metadata/env scaffolding
├── README.md                                   # Setup and runbook
└── summary.md                                  # This technical summary
```

### Prisma Data Model Summary

**Models (24):**
- `User` - with `avatarUrl`, `region`, `ou`, `title`, `onboardingCompleted`, `googleSub`
- `Team` - multi-tenant team container
- `Prompt` - with `tools[]`, `modality`, `thumbnailUrl`, `thumbnailStatus`, `thumbnailError`
- `PromptVersion` - version history for prompts
- `PromptVariable` - dynamic variable definitions for prompts
- `Skill` - markdown body skill documents (team-scoped)
- `SkillVariable` - dynamic variable definitions for skills
- `SkillFavorite` - user favorites for skills
- `SkillUsageEvent` - VIEW/COPY/SHARE tracking (skills)
- `ContextDocument` - markdown context files (team-scoped)
- `ContextVariable` - dynamic variable definitions for context documents
- `ContextFavorite` - user favorites for context documents
- `ContextUsageEvent` - VIEW/COPY/SHARE tracking (context documents)
- `Tag`, `PromptTag` - tagging system (prompts only currently)
- `Collection`, `CollectionPrompt` - curated prompt collections with `isSystem` flag for protected system collections
- `Favorite`, `Rating` - user engagement (prompts only currently)
- `UsageEvent` - VIEW/COPY/LAUNCH tracking (prompts)
- `ToolRequest` - tool submission requests with review workflow

**Enums (10):** `Role`, `PromptVisibility` (PUBLIC, TEAM, PRIVATE), `PromptStatus`, `UsageAction`, `PromptModality`, `ThumbnailStatus`, `SkillUsageAction`, `ContextUsageAction`, `ToolRequestStatus`

### Primary Data Flow / Lifecycle

1. Frontend mounts providers and requests `/api/*` resources through Axios.
2. Express applies session + auth middleware, derives user/team context, and scopes database access by `teamId`.
3. Routes validate request payloads/query params via Zod and execute Prisma queries.
4. Prompt engagement writes (usage/favorites/ratings) persist in relational tables.
5. Analytics route composes aggregates and rankings:
   - prompt performance (`topUsedPrompts`, `topRatedPrompts`, `stalePrompts`)
   - contributor output (`contributors`)
   - user engagement score leaderboard (`userEngagementLeaderboard`)
6. Prompt thumbnail generation executes async image generation and stores data URI/file URI in `Prompt.thumbnailUrl`.
7. Heroku deploy flow builds frontend, compiles server, serves SPA static assets from Express.

### API Routes Inventory

| Route File | Endpoints |
|------------|-----------|
| `auth.ts` | `GET /google`, `GET /google/callback`, `POST /logout`, `GET /me`, `PATCH /me`, `POST /me/profile-photo` |
| `assets.ts` | `GET /` (unified asset listing with type/tool/status/search filters, sort options, pagination, and facet counts) |
| `search.ts` | `GET /suggestions` (asset/filter suggestions), `GET /parse` (natural language query parsing via Gemini) |
| `prompts.ts` | Full CRUD, `DELETE /:id/permanent`, `/versions`, `/restore/:version`, `/favorite`, `/rating`, `/usage`, `/regenerate-thumbnail` |
| `skills.ts` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `DELETE /:id/permanent`, `POST /:id/usage`, `POST /:id/favorite`, `PUT /:id/variables` |
| `context.ts` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `DELETE /:id/permanent`, `POST /:id/usage`, `POST /:id/favorite`, `PUT /:id/variables` |
| `collections.ts` | CRUD + `/prompts/:promptId` membership + `POST /system/refresh` (admin-only system collection refresh) |
| `tags.ts` | `GET /`, `POST /` |
| `analytics.ts` | `GET /overview` (team-scoped aggregates) |
| `help.ts` | `POST /search` (AI-powered help search) |
| `toolRequests.ts` | `GET /approved-tools`, `POST /`, `GET /` (admin), `PATCH /:id` (admin review) |

### Frontend Routes Inventory

| Route | Component | Access |
|-------|-----------|--------|
| `/login` | `LoginPage` | Public |
| `/terms` | `TermsPage` | Public |
| `/privacy` | `PrivacyPage` | Public |
| `/help` | `HelpPage` | Public |
| `/` | `HomePage` | Protected |
| `/prompts` | `PromptsListPage` | Protected |
| `/prompts/new` | `PromptEditorPage` | Protected |
| `/prompts/:id` | `PromptDetailPage` | Protected |
| `/prompts/:id/edit` | `PromptEditPage` | Protected |
| `/skills` | `SkillListPage` | Protected |
| `/skills/new` | `SkillEditorPage` | Protected |
| `/skills/:id` | `SkillDetailPage` | Protected |
| `/skills/:id/edit` | `SkillEditPage` | Protected |
| `/context` | `ContextListPage` | Protected |
| `/context/new` | `ContextEditorPage` | Protected |
| `/context/:id` | `ContextDetailPage` | Protected |
| `/context/:id/edit` | `ContextEditPage` | Protected |
| `/collections` | `CollectionsPage` | Protected |
| `/collections/:id` | `CollectionDetailPage` | Protected |
| `/analytics` | `AnalyticsPage` | Admin only |
| `/admin/tool-requests` | `ToolRequestsPage` | Admin only |
| `/settings` | `SettingsPage` | Protected |
| `/changelog` | `ChangelogPage` | Protected |

### Major Modules and Why They Exist

- `server/src/routes/prompts.ts`: primary prompt API with filtering, sorting, pagination, CRUD, versions, and engagement.
- `server/src/routes/skills.ts`: skill CRUD with team scoping, search, archive (soft delete), and usage tracking.
- `server/src/routes/context.ts`: context document CRUD with team scoping, search, archive, and usage tracking.
- `server/src/routes/search.ts`: smart search API with asset/filter suggestions and natural language query parsing.
- `server/src/routes/analytics.ts`: consolidated overview payload consumed by homepage dashboards and leaderboards.
- `server/src/routes/help.ts`: help content search endpoint for the searchable help page.
- `server/src/services/nanoBanana.ts`: external image-generation bridge for prompt thumbnails via Gemini API.
- `server/src/services/helpSearch.ts`: help content search service with AI-powered question answering.
- `server/src/services/searchParser.ts`: natural language search query parser using Gemini with local heuristic fallback.
- `server/src/services/systemCollections.ts`: automatic tool-based and "Best of AI Library" collection management. Includes ChatGPT and Claude Cowork collections.
- `client/src/app/providers/ToastProvider.tsx`: toast notification context and UI for success/error/info feedback.
- `server/prisma/schema.prisma`: source of truth for users/teams/prompts/skills/context/engagement relations and enums.
- `client/src/features/home/HomePage.tsx`: unified homepage with hero section, featured assets, tool integration cards, and admin leaderboards.
- `client/src/features/assets/AssetCard.tsx`: unified card component for rendering prompts, skills, and context with consistent actions and relevance highlighting.
- `client/src/features/assets/api.ts`: unified assets API client for fetching all asset types with filtering, pagination, and facet counts.
- `server/src/routes/assets.ts`: unified assets API endpoint returning paginated list of all asset types with facet counts.
- `client/src/features/search/components/SearchBar.tsx`: unified search input with filter chips, keyboard shortcuts, and NL query submission.
- `client/src/features/search/components/FilterChip.tsx`: removable filter chip UI component.
- `client/src/features/search/components/SearchSuggestions.tsx`: auto-suggestions dropdown with keyboard navigation.
- `client/src/features/search/components/FacetedFilters.tsx`: clickable filter buttons showing result counts by type/tool.
- `client/src/features/search/components/SearchEmptyState.tsx`: helpful empty states for no results, no assets, and errors.
- `client/src/features/search/hooks/useSearchState.ts`: search state management hook with URL sync, debouncing, and NL parsing.
- `client/src/features/search/hooks/useSearchSuggestions.ts`: React Query hook for fetching search suggestions.
- `client/src/features/search/utils/highlight.tsx`: `highlightMatches()` and `truncateWithHighlight()` for relevance highlighting.
- `client/src/features/search/api.ts`: search API client for suggestions and NL query parsing.
- `client/src/features/prompts/PromptsListPage.tsx`: prompts-only list page with filters and PromptListCard components.
- `client/src/features/prompts/PromptDetailPage.tsx`: full prompt view with engagement chrome, variables/preview, versions, and external launch.
- `client/src/features/prompts/sharePrompt.ts`: Web Share API integration for prompt sharing.
- `client/src/lib/shareOrCopyLink.ts`: generic share utility used by Skills, Context, and Collections.
- `client/src/components/AppShell.tsx`: page chrome with navigation, theme toggle, footer with Help link and version display.
- `client/src/components/VariableEditor.tsx`: reusable component for defining template variables with key, label, default value, required flag.
- `client/src/components/VariableInputs.tsx`: runtime variable value entry component for detail pages.
- `client/src/lib/interpolate.ts`: centralized template variable interpolation logic for `[KEY]` and `{{KEY}}` placeholders.
- `client/src/data/changelog.ts`: structured changelog data for version history display.
- `client/src/pages/ChangelogPage.tsx`: version history display page with formatted entries.
- `scripts/version-bump.js`: automatic patch version increment script for Heroku builds.
- `client/src/components/AdminRoute.tsx`: redirects non-admin users away from admin-only routes (e.g. analytics).
- `client/src/components/MarkdownPreview.tsx`: reusable markdown rendering component using `react-markdown`.
- `client/src/features/prompts/interpolatePrompt.ts` / `launchProviders.ts`: client-side prompt variable fill-in and deep links to external chat products.
- `client/src/features/prompts/PromptThumbnail.tsx`: thumbnail rendering with graceful placeholder states and clickable regenerate button for failed thumbnails.
- `client/src/components/ConfirmDeleteModal.tsx`: reusable confirmation dialog for permanent asset deletion with warning messaging.
- `client/src/components/PublishStatusModal.tsx`: modal dialog for new asset creation prompting user to choose Draft or Published status with card-style options.
- `client/src/features/analytics/AnalyticsPage.tsx`: admin dashboard with top used, top rated, stale prompts, contributors, and user engagement leaderboards.
- `client/src/features/analytics/api.ts`: strict typed contract for analytics payload shape.
- `client/src/features/help/HelpPage.tsx`: searchable help documentation with topic index sidebar and AI search beta feature.
- `client/src/features/settings/SettingsPage.tsx`: dedicated settings page with profile editing, my content links, and my analytics links.
- `client/src/features/skills/SkillDetailPage.tsx`: skill detail view with copy button, markdown preview toggle, and share.
- `client/src/features/context/ContextDetailPage.tsx`: context detail view with copy button, markdown preview toggle, and share.
- `client/src/features/admin/ToolRequestsPage.tsx`: admin page for reviewing tool submission requests with status filtering and review modal.
- `client/src/features/prompts/ToolRequestModal.tsx`: modal form for submitting new tool requests with validation.
- `server/src/routes/toolRequests.ts`: tool request submission and admin review API endpoints.
- `server/src/lib/email.ts`: nodemailer-based email service with SMTP configuration.
- `server/src/services/email.ts`: tool request notification email templates.

## Replication and Setup

### 1) Install dependencies

```bash
npm --prefix client install
npm --prefix server install
```

### 2) Configure environment

Create `server/.env`:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://<user>:<password>@localhost:5432/promptlibrary
CORS_ORIGIN=http://localhost:5173
APP_BASE_URL=http://localhost:5173
SESSION_SECRET=<long-random-secret>
COOKIE_SECURE=false
SESSION_SAME_SITE=lax
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
GOOGLE_ALLOWED_DOMAIN=salesforce.com
BOOTSTRAP_ADMIN_EMAILS=admin1@example.com,admin2@example.com
NANO_BANANA_API_KEY=<google-generative-language-api-key>
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=60
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=<mailgun-smtp-user>
SMTP_PASS=<mailgun-smtp-password>
SMTP_FROM=noreply@yourdomain.com
TOOL_REQUEST_NOTIFY_EMAIL=admin@example.com
```

Optional `client/.env`:

```env
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 3) Database migration + seed

```bash
npm --prefix server run prisma:migrate -- --name init
npm --prefix server run prisma:generate
npm --prefix server run prisma:seed
```

Reset/reseed:

```bash
SEED_RESET=true npm --prefix server run prisma:seed
```

### 4) Run locally

```bash
npm --prefix server run dev
npm --prefix client run dev
```

### 5) Validate

```bash
npm --prefix server test
npm --prefix server run build
npm --prefix client run build
```

### 6) Deploy

```bash
git push heroku main
```

## Maintenance Mode

### TODO/FIXME Scan

- Repository scan for `TODO|FIXME` in `*.{ts,tsx,js,jsx}` completed (April 16, 2026): no matches in application source.
- Workspace automation rules may still mention `TODO|FIXME` as documentation; that is non-runtime.

### Roadmap / Backlog

**Remaining Feature Work:**

1. **Feature Parity for Skills/Context** — Tags (SkillTag/ContextTag models, endpoints, picker UI, filter chips); Ratings; Versioning (lower priority). Favorites and Variables are now complete.

2. **Analytics Enhancements** — Add time-range selector; add skill/context usage stats to overview.

**Completed in Recent Sessions:**

- ✅ Smart AI Search — Unified search bar with NL parsing (Gemini), auto-suggestions, filter chips, relevance highlighting, faceted counts, and empty states. New `/api/search/suggestions` and `/api/search/parse` endpoints.
- ✅ Template Variables for Skills/Context — Extended variable system with SkillVariable/ContextVariable models, editor UI, and interpolation.
- ✅ Skills/Context Favorites — Added SkillFavorite/ContextFavorite models with toggle endpoints and UI.
- ✅ Changelog System — Version history display with automatic version bump during deploys.
- ✅ Dedicated Settings Page — Full-page `/settings` route with profile editing, my content, and my analytics.
- ✅ Quick-Create Actions — Dropdown menu with "New Prompt", "New Skill", "New Context" options.
- ✅ System Collections — Automatic tool-based and "Best of AI Library" collections with protection.
- ✅ Help Page AI Search — Beta AI-powered question answering for help content.
- ✅ Sharing Feature Expansion — Created generic `shareOrCopyLink.ts` utility; added share to Skills, Context, Collections.
- ✅ Analytics Dashboard Enhancement — Added Top Rated, Contributors, User Engagement leaderboards.
- ✅ Content Copy & Markdown Preview — Added copy buttons, `react-markdown` preview, usage tracking.
- ✅ Comprehensive Copy Rewrite — Salesforce voice, individual-focused, action-oriented.
- ✅ Help Page — Searchable, indexed help documentation.

**Technical Debt:**

- Add retry guardrails for thumbnail backfill jobs to avoid repeated processing on persistent provider errors.
- Add provider capability check/health endpoint for image model compatibility before runtime generation attempts.
- Expand end-to-end tests for homepage leaderboards to validate user-engagement score ranking behavior.
- Add API contract tests for analytics response shape changes (`userEngagementLeaderboard`) to prevent frontend drift.
- Add structured observability around external image generation failures and recovery paths.
- Tune prompt/engagement indexes for larger production datasets and leaderboard query efficiency.
