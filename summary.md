# Prompt Library - Technical Summary

Last Updated: Monday, April 06, 2026 at 17:45 CDT
Build Version: 555f1a9

## Recent Changes

- **`GET /api/prompts`**: List response `meta` now includes `snapshot` with `promptsPublished` (published prompts scoped by team; non-admin/owner users only count prompts that are `PUBLIC` or owned by them), `activeUsers` (users belonging to the team), and `promptsViewed` (team-scoped `UsageAction.VIEW` events). The legacy missing-column fallback returns the same `meta.snapshot` shape. `pagination.test.ts` mocks `prisma.user.count` and `prisma.usageEvent.count` and asserts snapshot values.
- **`PromptListPage`**: Hero eyebrow reads “Welcome to the Prompt Library”; live snapshot stats use `meta.snapshot` from the list endpoint when present (test fixtures updated). Snapshot grid keeps a three-column layout from the `sm` breakpoint for all signed-in users. Removed the “What you unlock” panel and the hero secondary CTAs (“Create Winning Prompt” / “Explore Collections”). `client/src/features/prompts/api.ts` types `ListMeta.snapshot` accordingly.
- **Branding**: Added `client/public/salesforce-logo.svg` (Simple Icons–style cloud, brand blue). `client/index.html` favicon links, `AppShell` header mark, and Express `/favicon.ico` redirect target `/salesforce-logo.svg` instead of `/favicon.svg`.
- **Theme**: New CSS variables `--color-launch` and `--color-launch-hover`; list and detail “Open in …” / copy actions use them instead of hard-coded amber utilities.
- **`AppShell`**: “New Prompt” moved into the right-hand header actions; header **Logout** removed. Profile/welcome modal footer now includes **Logout** (via `handleLogout`) with **Cancel** / **Save**, using a responsive row layout.
- **Earlier `PromptListPage` work**: Single “Live platform snapshot” panel with `HeroStatIcon` and `StatCounter` (easing, stagger, `prefers-reduced-motion`, idle state until analytics when those metrics come from analytics). Removed the “Built for Salesforce by Salesforce” tri-card; tightened “Built for Every AI Tool & User” copy.
- `PromptDetailPage` brought in line with list cards: average and personal star ratings, owner avatar, view count and relative activity label, modality/tool/tag chips, Web Share API or clipboard link copy, favorite toggle, `PromptCollectionMenu`, variable template section with live preview (or editable body when there are no variables), and a consolidated launch row with provider selector—rebuilt from Cursor checkpoint diff applied to the prior detail implementation.
- Account experience: removed dedicated `SettingsPage`; profile, appearance, and onboarding continue in `AppShell` modals; added `AppShell` component tests.
- Admin access: `AdminRoute` + `features/auth/roles.ts` gate `/analytics` to `ADMIN` and `OWNER` roles; server assigns `ADMIN` on Google OAuth for emails listed in `BOOTSTRAP_ADMIN_EMAILS` (comma-separated, lowercased at parse) without ever demoting `OWNER`.
- Prompts UX: `PromptListCard`, `PromptUpdatedBadge` / `recentPromptUpdate`, `interpolatePrompt` for `{{variable}}` substitution, and `launchProviders` (ChatGPT, Claude, Gemini) for opening composed text in external UIs; list/detail/edit/create flows expanded accordingly.
- API/types: `Prompt` includes `createdAt` and `updatedAt`; client `api.ts` and server `prompts` routes extended with related behavior; analytics/auth routes adjusted; `prompts-flow` and other server tests extended, client tests for interpolation and recent-update helpers added.
- Build fix: TypeScript test mocks updated for stricter `Prompt` typing (`AppShell.test.tsx` import cleanup, `PromptEditPage.test.tsx` timestamps).
- Prompt list API (`GET /api/prompts`): each row includes `owner`, `tags`, aggregated `viewCount` (`UsageAction.VIEW`), and per-session `favorited` / `myRating`. `PromptListCard` surfaces average stars, personal rating, favorite toggle, share/native copy, collection bookmark menu, activity label, and tool/modality/tag chips atop thumbnails and launch/copy actions; list chrome splits into `promptActionIcons.tsx` and `promptTagChips.ts`.

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
│   ├── public/                                 # Vite static assets (e.g. salesforce-logo.svg)
│   ├── src/
│   │   ├── app/
│   │   │   ├── providers/ThemeProvider.tsx    # Theme state + persisted/system mode bootstrap
│   │   │   └── router.tsx                      # Authenticated route graph
│   │   ├── assets/                             # Bundled static assets
│   │   ├── components/                         # Shared UI shell/chrome (AppShell, ProtectedRoute, AdminRoute)
│   │   ├── features/
│   │   │   ├── prompts/                        # Discovery/detail/create/edit, cards, filters, interpolation, external launch
│   │   │   ├── analytics/                      # Typed analytics client contracts
│   │   │   ├── collections/                    # Collection CRUD + membership surfaces
│   │   │   └── auth/                           # OAuth entry + role helpers (no standalone settings route)
│   │   ├── styles/                             # Design tokens + theme semantics
│   │   └── main.tsx                            # Bootstrap + providers
├── server/                                     # Express + Prisma backend
│   ├── prisma/
│   │   ├── schema.prisma                       # Canonical data model
│   │   ├── migrations/                         # Applied schema migrations
│   │   └── seed.ts                             # Demo data generation/reset
│   ├── src/
│   │   ├── app.ts                              # Middleware + routes + SPA static hosting
│   │   ├── routes/
│   │   │   ├── prompts.ts                      # Prompt CRUD/search/rating/usage/favorites/thumbnail orchestration
│   │   │   ├── analytics.ts                    # Top-used/stale/contributors/user-engagement scoreboard
│   │   │   ├── collections.ts                  # Collection operations
│   │   │   ├── tags.ts                         # Tag management
│   │   │   └── auth.ts                         # Google OAuth + session lifecycle
│   │   └── services/nanoBanana.ts              # Image generation adapter
│   └── test/                                   # API behavior tests
├── Procfile                                    # Heroku process model
├── app.json                                    # Heroku app metadata/env scaffolding
├── README.md                                   # Setup and runbook
└── summary.md                                  # This technical summary
```

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

### Major Modules and Why They Exist

- `server/src/routes/prompts.ts`: primary prompt API with filtering, sorting, pagination, CRUD, versions, and engagement.
- `server/src/routes/analytics.ts`: consolidated overview payload consumed by homepage dashboards and leaderboards.
- `server/src/services/nanoBanana.ts`: external image-generation bridge for prompt thumbnails.
- `server/prisma/schema.prisma`: source of truth for users/teams/prompts/engagement relations and enums.
- `client/src/features/prompts/PromptListPage.tsx`: homepage/discovery UX, list cards, filters, hero stats, and leaderboards.
- `client/src/features/prompts/PromptDetailPage.tsx`: full prompt view with engagement chrome, variables/preview, versions, and external launch.
- `client/src/components/AdminRoute.tsx`: redirects non-admin users away from admin-only routes (e.g. analytics).
- `client/src/features/prompts/interpolatePrompt.ts` / `launchProviders.ts`: client-side prompt variable fill-in and deep links to external chat products.
- `client/src/features/prompts/PromptThumbnail.tsx`: thumbnail rendering with graceful placeholder states.
- `client/src/features/analytics/api.ts`: strict typed contract for analytics payload shape.

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

- Repository scan for `TODO|FIXME` in `*.{ts,tsx,js,jsx}` completed (April 06, 2026): no matches in application source.
- Workspace automation rules may still mention `TODO|FIXME` as documentation; that is non-runtime.

### Roadmap / Backlog

- Add retry guardrails for thumbnail backfill jobs to avoid repeated processing on persistent provider errors.
- Add provider capability check/health endpoint for image model compatibility before runtime generation attempts.
- Expand end-to-end tests for homepage leaderboards to validate user-engagement score ranking behavior.
- Add API contract tests for analytics response shape changes (`userEngagementLeaderboard`) to prevent frontend drift.
- Add structured observability around external image generation failures and recovery paths.
- Tune prompt/engagement indexes for larger production datasets and leaderboard query efficiency.
