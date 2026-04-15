# AI Library - Technical Summary

Last Updated: Wednesday, April 15, 2026 — 16:32 CDT
Build Version: 73b5376

## Recent Changes

- **Header branding refinement**: Changed header title from "SF AI Library" to "AI Library" in AppShell navigation for cleaner branding presentation.
- **Comprehensive copy rewrite**: Rewrote all user-facing content with Salesforce voice—warm, approachable, action-oriented, and individual-focused. Updated headings, CTAs, descriptions, empty states, and form labels across all pages.
- **Searchable Help page**: Created new `/help` route with searchable, indexed help content organized by topic (Getting Started, Prompts, Skills, Context, Collections, Using AI Tools, Your Profile, Tips & Best Practices). Added footer links in AppShell and LoginPage.
- **Skill/Context usability enhancements**: Added copy-to-clipboard buttons, markdown preview toggle with `react-markdown`, and share functionality (Web Share API with clipboard fallback) to SkillDetailPage and ContextDetailPage.
- **Analytics dashboard expansion**: Added Top Rated Prompts, Contributors leaderboard, and User Engagement leaderboard sections to AnalyticsPage.
- **Backend usage tracking for Skills/Context**: Added `/api/skills/:id/usage` and `/api/context/:id/usage` endpoints with Prisma schema updates for `SkillUsageEvent` and `ContextUsageEvent` models.
- **AppShell styling**: Replaced off-brand gradient "New Prompt" button with on-brand `--color-launch` (Salesforce orange) styling.
- **PromptListPage tool ordering**: Tool options now sort alphabetically with "slackbot" pinned first.
- **Login page branding**: Updated tagline to "Prompts, Skills and Context for you, by you." and added footer with copyright/attribution.
- **Earlier work (carried forward)**: Site audit against implementation spec; Salesforce logo inline with "AI Library" h1 in flex row; Skills and Context Document full-stack features; session cookie renamed to `ailibrary.sid`; AppShell navigation updated; full rebrand to AI Library at `https://ail.mysalesforcedemo.com`; prompt engagement UX (star ratings, favorites, share, launch providers, `{{variable}}` interpolation, thumbnail generation).

## Audit Summary

The application has achieved **substantial completion** of the core implementation spec with significant improvements deployed in recent sessions. The original prompt-focused design has been extended to include Skills and Context Documents with enhanced usability features.

### Implementation Status Overview

| Component | Status |
|-----------|--------|
| Authentication (Google SSO, sessions, team scoping) | ✅ Complete |
| Prisma Data Model (all spec models + Skill/ContextDocument + usage events) | ✅ Complete |
| Prompt APIs (CRUD, versions, engagement, thumbnails) | ✅ Complete |
| Skills APIs (CRUD, list, search, usage tracking) | ✅ Complete |
| Context Documents APIs (CRUD, list, search, usage tracking) | ✅ Complete |
| Tags, Collections, Analytics APIs | ✅ Complete |
| Frontend Routes (all spec routes + Skills/Context + Help) | ✅ Complete |
| Theme System (dark/light/system, persistence) | ✅ Complete |
| Share Functionality | ✅ Complete (Prompts, Skills, Context, Collections) |
| Analytics Dashboard UI | ✅ Complete (Top Used, Top Rated, Stale, Contributors, User Engagement) |
| Skills/Context Feature Parity | ⚠️ Partial (no versioning, tags, favorites, ratings) |
| Help Documentation | ✅ Complete (searchable, indexed by topic) |
| Salesforce Brand Voice | ✅ Complete (individual-focused, action-oriented) |

### Identified Gaps (Prioritized)

1. **Feature Parity**: Skills/Context missing versioning, tags, collections, favorites, ratings.
2. **Minor**: No dedicated `/settings` route (modal only); AppShell only has "New Prompt" quick-action (could add "New Skill"/"New Context").

### Remediation Roadmap (Updated)

| Phase | Description | Scope |
|-------|-------------|-------|
| 1 | Feature Parity for Skills/Context | Tags, Favorites, Ratings, Versioning (lower priority) |
| 2 | Quick-Create Actions & Navigation | Add "New Skill"/"New Context" to AppShell; dedicated `/settings` route |

## Technical Architecture

### Core Stack

- Backend runtime: Node.js 20+
- Backend framework: Express `^5.2.1`
- Backend language: TypeScript `^5.9.3`
- Validation: Zod `^4.3.6`
- Database/ORM: PostgreSQL + Prisma (`@prisma/client` `^6.19.3`, `prisma` `^6.19.3`)
- Session/auth infra: `express-session` `^1.19.0`, `connect-pg-simple` `^10.0.0`, `jose` `^6.2.2`
- Data/HTTP utilities: `pg` `^8.20.0`, `cors` `^2.8.6`, `cookie-parser` `^1.4.7`
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
│   │   │   ├── prompts/                        # Discovery/detail/create/edit, cards, filters, interpolation, external launch, share
│   │   │   ├── skills/                         # Skill list/detail/create/edit (markdown body, copy, share, usage tracking)
│   │   │   ├── context/                        # Context (markdown) list/detail/create/edit (copy, share, usage tracking)
│   │   │   ├── analytics/                      # Admin analytics dashboard (top used/rated, contributors, user engagement)
│   │   │   ├── collections/                    # Collection CRUD + membership surfaces + share
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
│   │   │   ├── analytics.ts                    # Top-used/stale/contributors/user-engagement scoreboard
│   │   │   ├── collections.ts                  # Collection operations
│   │   │   ├── tags.ts                         # Tag management
│   │   │   ├── help.ts                         # Help search endpoint
│   │   │   └── auth.ts                         # Google OAuth + session lifecycle
│   │   ├── services/
│   │   │   ├── nanoBanana.ts                   # Image generation adapter (Gemini API)
│   │   │   └── helpSearch.ts                   # Help content search service
│   └── test/                                   # API behavior tests
├── Procfile                                    # Heroku process model
├── app.json                                    # Heroku app metadata/env scaffolding
├── README.md                                   # Setup and runbook
└── summary.md                                  # This technical summary
```

### Prisma Data Model Summary

**Models (19):**
- `User` - with `avatarUrl`, `region`, `ou`, `title`, `onboardingCompleted`, `googleSub`
- `Team` - multi-tenant team container
- `Prompt` - with `tools[]`, `modality`, `thumbnailUrl`, `thumbnailStatus`, `thumbnailError`
- `PromptVersion` - version history for prompts
- `Skill` - markdown body skill documents (team-scoped)
- `ContextDocument` - markdown context files (team-scoped)
- `Tag`, `PromptTag` - tagging system (prompts only currently)
- `Collection`, `CollectionPrompt` - curated prompt collections
- `Favorite`, `Rating` - user engagement (prompts only currently)
- `PromptVariable` - dynamic variable definitions
- `UsageEvent` - VIEW/COPY/LAUNCH tracking (prompts)
- `SkillUsageEvent` - VIEW/COPY/SHARE tracking (skills)
- `ContextUsageEvent` - VIEW/COPY/SHARE tracking (context documents)

**Enums (9):** `Role`, `PromptVisibility`, `PromptStatus`, `UsageAction`, `PromptModality`, `ThumbnailStatus`, `SkillUsageAction`, `ContextUsageAction`

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
| `auth.ts` | `GET /google`, `GET /google/callback`, `POST /logout`, `GET /me`, `PATCH /me` |
| `prompts.ts` | Full CRUD, `/versions`, `/restore/:version`, `/favorite`, `/rating`, `/usage`, `/regenerate-thumbnail` |
| `skills.ts` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `POST /:id/usage` |
| `context.ts` | `GET /`, `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`, `POST /:id/usage` |
| `collections.ts` | CRUD + `/prompts/:promptId` membership |
| `tags.ts` | `GET /`, `POST /` |
| `analytics.ts` | `GET /overview` (team-scoped aggregates) |
| `help.ts` | `GET /search` (help content search) |

### Frontend Routes Inventory

| Route | Component | Access |
|-------|-----------|--------|
| `/login` | `LoginPage` | Public |
| `/terms` | `TermsPage` | Public |
| `/privacy` | `PrivacyPage` | Public |
| `/help` | `HelpPage` | Public |
| `/` | `PromptListPage` | Protected |
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

### Major Modules and Why They Exist

- `server/src/routes/prompts.ts`: primary prompt API with filtering, sorting, pagination, CRUD, versions, and engagement.
- `server/src/routes/skills.ts`: skill CRUD with team scoping, search, archive (soft delete), and usage tracking.
- `server/src/routes/context.ts`: context document CRUD with team scoping, search, archive, and usage tracking.
- `server/src/routes/analytics.ts`: consolidated overview payload consumed by homepage dashboards and leaderboards.
- `server/src/routes/help.ts`: help content search endpoint for the searchable help page.
- `server/src/services/nanoBanana.ts`: external image-generation bridge for prompt thumbnails via Gemini API.
- `server/src/services/helpSearch.ts`: help content search service with topic indexing.
- `server/prisma/schema.prisma`: source of truth for users/teams/prompts/skills/context/engagement relations and enums.
- `client/src/features/prompts/PromptListPage.tsx`: homepage/discovery UX, list cards, filters, hero stats, and leaderboards.
- `client/src/features/prompts/PromptDetailPage.tsx`: full prompt view with engagement chrome, variables/preview, versions, and external launch.
- `client/src/features/prompts/sharePrompt.ts`: Web Share API integration for prompt sharing.
- `client/src/lib/shareOrCopyLink.ts`: generic share utility used by Skills, Context, and Collections.
- `client/src/components/AppShell.tsx`: page chrome with navigation, theme toggle, and footer with Help link.
- `client/src/components/AdminRoute.tsx`: redirects non-admin users away from admin-only routes (e.g. analytics).
- `client/src/components/MarkdownPreview.tsx`: reusable markdown rendering component using `react-markdown`.
- `client/src/features/prompts/interpolatePrompt.ts` / `launchProviders.ts`: client-side prompt variable fill-in and deep links to external chat products.
- `client/src/features/prompts/PromptThumbnail.tsx`: thumbnail rendering with graceful placeholder states.
- `client/src/features/analytics/AnalyticsPage.tsx`: admin dashboard with top used, top rated, stale prompts, contributors, and user engagement leaderboards.
- `client/src/features/analytics/api.ts`: strict typed contract for analytics payload shape.
- `client/src/features/help/HelpPage.tsx`: searchable help documentation with topic index sidebar.
- `client/src/features/skills/SkillDetailPage.tsx`: skill detail view with copy button, markdown preview toggle, and share.
- `client/src/features/context/ContextDetailPage.tsx`: context detail view with copy button, markdown preview toggle, and share.

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

- Repository scan for `TODO|FIXME` in `*.{ts,tsx,js,jsx}` completed (April 15, 2026): no matches in application source.
- Workspace automation rules may still mention `TODO|FIXME` as documentation; that is non-runtime.

### Roadmap / Backlog

**Remaining Feature Work:**

1. **Feature Parity for Skills/Context** — Tags (SkillTag/ContextTag models, endpoints, picker UI, filter chips); Favorites (SkillFavorite/ContextFavorite models, toggle endpoints, UI); Ratings; Versioning (lower priority).

2. **Quick-Create Actions** — Add "New Skill" and "New Context" buttons to AppShell (dropdown menu); add dedicated `/settings` route.

3. **Analytics Enhancements** — Add time-range selector; add skill/context usage stats to overview.

**Completed in Recent Sessions:**

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
