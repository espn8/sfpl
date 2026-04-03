# Prompt Library - Technical Summary

Last Updated: Friday, April 03, 2026 at 09:59 CDT
Build Version: 04abdcd

## Recent Changes

- Implemented tri-mode theming (`dark` default, `light`, `system`) with centralized tokenized styling across key frontend views.
- Added `ThemeProvider` boot-time theme initialization and a reusable `ThemeModeToggle` surfaced in global navigation and settings.
- Refactored major UI screens (prompts, collections, analytics, auth shell/pages) to use semantic CSS variables from centralized theme files.
- Expanded seed data from minimal samples to an end-to-end demo dataset with 4 user roles, 10 tags, 8 prompts, variables, collections, ratings, favorites, and usage events.
- Added resettable demo seeding via `SEED_RESET=true|1|yes`, which safely clears only `demo-team` data before reseeding.
- Validated the new seed workflow by executing both normal seed and reset + reseed paths successfully.

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
- Test stack: Vitest (server `^4.1.2`, client `^3.2.4`), Supertest `^7.2.2`, RTL/JSDOM on client

### Runtime and System Requirements

- Node.js 20+
- npm 9+
- PostgreSQL (local or Heroku Postgres)
- Heroku CLI (for deployment)
- Google Cloud OAuth client credentials

### Third-Party APIs / Webhooks

- Google OAuth 2.0 / OIDC
  - Role: authenticate users and mint/verify session identity
  - Implementation: `server/src/routes/auth.ts`
- Google JWKS endpoint (`https://www.googleapis.com/oauth2/v3/certs`)
  - Role: verify Google ID token signatures
  - Implementation: `server/src/routes/auth.ts`
- Heroku platform + Heroku Postgres
  - Role: deployment runtime and managed database
  - Implementation references: `Procfile`, `app.json`, `server/prisma/schema.prisma`
- GitHub Actions CI
  - Role: branch/PR quality checks
  - Implementation: `.github/workflows/ci.yml`

## Project Blueprint

### Directory Layout (commented)

```text
.
├── client/                                  # React + Vite frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── providers/ThemeProvider.tsx # Theme mode state + boot initialization
│   │   │   └── router.tsx                   # Authenticated route graph
│   │   ├── components/
│   │   │   ├── AppShell.tsx                 # Shared app chrome + global navigation
│   │   │   └── ui/ThemeModeToggle.tsx       # Theme mode control
│   │   ├── features/                        # Feature pages + API calls
│   │   ├── styles/
│   │   │   ├── tokens.css                   # Design tokens
│   │   │   └── theme.css                    # Dark/light semantic color maps
│   │   ├── index.css                        # Tailwind import + global base styles
│   │   └── main.tsx                         # App bootstrap + providers
├── server/                                  # Express + Prisma backend
│   ├── prisma/
│   │   ├── schema.prisma                    # DB models/enums/relations
│   │   └── seed.ts                          # Idempotent + resettable demo data generation
│   ├── src/
│   │   ├── app.ts                           # Middleware + routes + static hosting
│   │   ├── index.ts                         # Runtime entrypoint
│   │   ├── lib/prisma.ts                    # Prisma singleton
│   │   ├── middleware/                      # Auth, errors, rate limiting
│   │   └── routes/                          # Auth, prompts, tags, collections, analytics
│   └── test/                                # API behavior tests
├── Procfile                                 # Heroku release/web process model
├── README.md                                # Local and deployment setup
└── summary.md                               # This comprehensive summary
```

### Primary Data Flow / Lifecycle

1. Frontend boots, applies persisted/system theme before first paint, then mounts React providers.
2. Browser requests API data under `/api/*`; Express applies session/auth middleware and team-scoped access.
3. Routes validate request input with Zod and execute Prisma queries constrained by authenticated `teamId`.
4. Prompt interactions (view/copy/launch/favorite/rate) update relational tables and feed analytics rollups.
5. Seed workflow can create an idempotent baseline dataset or fully reset and recreate demo-team data.
6. Production deploy runs Prisma migrations in `release` process, then serves built frontend through Express.

### Major Modules and Why They Exist

- `server/src/routes/prompts.ts`: central prompt domain API (search/filter/sort/pagination + CRUD + engagement).
- `server/src/routes/collections.ts`: collection management and prompt membership orchestration.
- `server/src/routes/analytics.ts`: usage-derived insights (top used, stale prompts, activity summaries).
- `server/prisma/seed.ts`: deterministic demo data generation to validate end-to-end functionality quickly.
- `client/src/features/prompts/*`: discovery, detail, create/edit flows mapped directly to backend capabilities.
- `client/src/features/collections/*`: collection browsing and organization workflows.
- `client/src/features/auth/*`: OAuth entry, authenticated profile/settings surfaces.
- `client/src/app/providers/ThemeProvider.tsx`: persistent tri-mode theme state and system preference handling.
- `client/src/styles/theme.css`: centralized semantic colors to keep components theme-agnostic.

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
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=60
```

Optional client env (`client/.env`):

```env
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 3) Database setup and demo data

```bash
npm --prefix server run prisma:migrate -- --name init
npm --prefix server run prisma:generate
npm --prefix server run prisma:seed
```

Reset and regenerate the demo baseline:

```bash
SEED_RESET=true npm --prefix server run prisma:seed
```

### 4) Run locally

```bash
npm --prefix server run dev
npm --prefix client run dev
```

### 5) Validate and build

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

- Repository scan for `TODO|FIXME` completed.
- No outstanding application-code TODO/FIXME markers were found in tracked source files.
- One TODO/FIXME mention is in workspace rule text only and does not represent unresolved runtime functionality.

### Roadmap / Backlog

- Add frontend tests for new theme provider and mode toggle persistence/system reactivity.
- Add integration tests for `SEED_RESET` behavior to prevent regression in relational cleanup order.
- Expand API contract docs for prompt filters, pagination metadata, and collection membership mutation payloads.
- Add observability instrumentation (structured logs + error reporting) for auth callbacks and seed operations.
- Add performance/index tuning and query plans as prompt/usage data volume scales.
