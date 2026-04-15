# AI Library - Technical Summary

Last Updated: Wednesday, April 15, 2026 — 19:57 CDT
Build Version: 1f47748

## Recent Changes

- **Skills feature (full-stack)**: New `Skill` Prisma model (`id`, `teamId`, `ownerId`, `title`, `summary`, `body`, `visibility`, `status`, `createdAt`, `updatedAt`) with team-scoped compound index on `(teamId, updatedAt)`. Migration `20260414155302_skill_and_context_document` applies the DDL. Server route `/api/skills` (`server/src/routes/skills.ts`) provides paginated list with full-text search (`q`), status filter, and full CRUD; access gated by `requireAuth` with admin/owner checks for destructive operations. Client `features/skills/` delivers `SkillListPage`, `SkillDetailPage`, `SkillEditorPage` (create), and `SkillEditPage` (update) with a matching `api.ts` client. Router registers protected routes at `/skills`, `/skills/new`, `/skills/:id`, and `/skills/:id/edit`. Integration test in `server/test/skills-flow.test.ts`.
- **Context Documents feature (full-stack)**: New `ContextDocument` Prisma model with identical shape to `Skill`. Server route `/api/context` (`server/src/routes/context.ts`) mirrors the skills API surface. Client `features/context/` delivers `ContextListPage`, `ContextDetailPage`, `ContextEditorPage`, and `ContextEditPage` with `api.ts`. Router registers protected routes at `/context`, `/context/new`, `/context/:id`, and `/context/:id/edit`. Integration test in `server/test/context-flow.test.ts`.
- **`app.ts` route registration**: `skillsRouter` mounted at `/api/skills` and `contextRouter` at `/api/context`; session cookie renamed from `promptlibrary.sid` to `ailibrary.sid` to reflect rebrand.
- **`AppShell` navigation**: Added "Skills" and "Context" nav links alongside "Prompts" and "Collections". Header brand mark now displays "SF AI Library" text label next to the Salesforce logo. Avatar DiceBear seed updated from `PromptLibrary` to `AILibrary`. Welcome modal title updated to "Welcome to SF AI Library".
- **Seed**: `server/prisma/seed.ts` seeds sample `Skill` and `ContextDocument` records for the demo team/user.
- **`app.json`**: Heroku app metadata updated (name and environment variable scaffolding aligned with AI Library rebrand).
- **README**: Updated with Skills/Context feature sections, route table, and setup notes.
- **Earlier work (carried forward)**: Full rebrand to **AI Library** at `https://ail.mysalesforcedemo.com`. `GET /api/prompts` `meta.snapshot` (published count, active users, view events). `PromptListPage` hero stats grid. Salesforce SVG favicon. `--color-launch` / `--color-launch-hover` CSS tokens. `AppShell` profile/logout modal. Admin-gated analytics route (`AdminRoute` + `roles.ts`). Full prompt engagement UX: star ratings, favorites, share, launch providers (ChatGPT, Claude, Gemini), `{{variable}}` interpolation, thumbnail generation via Google Generative Language API.

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
│   │   │   ├── skills/                         # Skill list/detail/create/edit (markdown body)
│   │   │   ├── context/                        # Context (markdown) list/detail/create/edit
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
│   │   │   ├── skills.ts                       # Skill CRUD + list search (team-scoped)
│   │   │   ├── context.ts                      # Context document CRUD + list search (team-scoped)
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
