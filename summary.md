# Prompt Library - Technical Summary

Last Updated: Thursday, April 02, 2026 at 11:51 CDT
Build Version: 05560ca

## Recent Changes

- Refactored backend bootstrap by extracting app construction into `server/src/app.ts` and slimming `server/src/index.ts` to process startup only.
- Added auth endpoint rate limiting with `express-rate-limit` in `server/src/middleware/rateLimit.ts` and applied it to `GET /api/auth/google`, `GET /api/auth/google/start`, `GET /api/auth/google/callback`, and `POST /api/auth/logout`.
- Added request validation and structured bad-request responses via Zod across `server/src/routes/prompts.ts`, `server/src/routes/collections.ts`, `server/src/routes/tags.ts`, and callback query validation in `server/src/routes/auth.ts`.
- Added pagination support (`page`, `pageSize`, `meta`) for list APIs in `prompts` and `collections` routes.
- Added server test infrastructure (Vitest + Supertest) with coverage for auth sessions, auth rate limiting, list pagination, collections membership edge cases, and prompt version flows.
- Added CI pipeline at `.github/workflows/ci.yml` to run server tests/build and client build on pushes to `main` and pull requests.
- Updated `README.md` to reflect CI checks.

## Technical Architecture

### Core Stack

- Backend runtime: Node.js (project requirement: 20+, CI uses 20)
- Backend framework: Express `^5.2.1`
- Backend language: TypeScript `^5.9.3`
- Validation: Zod `^4.3.6`
- DB/ORM: PostgreSQL + Prisma (`@prisma/client` `^6.19.2`, `prisma` `^6.19.2`)
- Session stack: `express-session` `^1.19.0` + `connect-pg-simple` `^10.0.0` + `pg` `^8.20.0`
- Auth/token verification: `jose` `^6.2.2`
- Rate limiting: `express-rate-limit` `^8.3.2`
- Testing (server): Vitest `^4.1.2`, Supertest `^7.2.2`
- Frontend framework: React `^19.2.4`
- Frontend tooling: Vite `^8.0.1`, TypeScript `~5.9.3`, Tailwind CSS `^4.2.2`
- Frontend routing/data: React Router DOM `^7.13.2`, TanStack Query `^5.95.2`, Axios `^1.14.0`

### Runtime and System Requirements

- Node.js 20+
- npm 9+
- PostgreSQL (local or Heroku Postgres)
- Heroku CLI (deployment workflow)
- Google Cloud OAuth credentials

### Third-Party APIs / Integrations

- Google OAuth 2.0 + OIDC
  - Role: user SSO and callback token exchange
  - Files: `server/src/routes/auth.ts`
- Google JWKS (`https://www.googleapis.com/oauth2/v3/certs`)
  - Role: verify Google ID token signatures
  - Files: `server/src/routes/auth.ts`
- Heroku platform + Heroku Postgres
  - Role: application hosting + managed PostgreSQL
  - Files: `Procfile`, `app.json`, `server/prisma/schema.prisma`
- GitHub Actions
  - Role: continuous integration on push/PR
  - Files: `.github/workflows/ci.yml`

## Project Blueprint

### Directory Layout (commented)

```text
.
├── .github/
│   └── workflows/
│       └── ci.yml                  # CI matrix for server/client checks
├── client/                         # React + Vite frontend
│   ├── src/                        # App code (features, routes, shared UI)
│   ├── package.json                # Frontend deps/scripts
│   └── vite.config.ts              # Vite config
├── server/                         # Express + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma           # DB schema
│   │   └── seed.ts                 # Seed data
│   ├── src/
│   │   ├── app.ts                  # Express app factory and middleware wiring
│   │   ├── index.ts                # Runtime entrypoint + app.listen
│   │   ├── config/env.ts           # Environment parsing/validation
│   │   ├── lib/prisma.ts           # Prisma client singleton
│   │   ├── middleware/
│   │   │   ├── auth.ts             # Auth context + guards
│   │   │   ├── errorHandler.ts     # Centralized error handler
│   │   │   └── rateLimit.ts        # Auth route limiter
│   │   └── routes/                 # API route handlers
│   ├── test/                       # Vitest + Supertest tests
│   ├── vitest.config.ts            # Test config
│   └── package.json                # Backend deps/scripts
├── README.md                       # Setup/deploy guide
├── Procfile                        # Heroku release + web processes
└── summary.md                      # This technical summary
```

### Primary Data Flow

1. Browser requests frontend assets from Express static hosting (`server/public`) or API routes under `/api/*`.
2. Session middleware loads/stores auth session in PostgreSQL-backed session table.
3. Authenticated routes derive user/team context from session via `getAuthContext`.
4. Route handlers validate query/body/params with Zod where implemented.
5. Route handlers execute Prisma queries scoped by `teamId`.
6. API responses return typed JSON payloads and uniform error payloads.
7. Global error middleware handles uncaught route exceptions.

### Major Module Responsibilities

- `server/src/app.ts`: composes middleware, routes, static serving, and global error handling; supports injectable session store for tests.
- `server/src/index.ts`: production runtime bootstrap (`createApp()` + `listen`).
- `server/src/middleware/rateLimit.ts`: enforces per-IP/per-user auth throttling; configurable by `AUTH_RATE_LIMIT_WINDOW_MS` and `AUTH_RATE_LIMIT_MAX`.
- `server/src/routes/auth.ts`: OAuth start/callback/session endpoints, state+nonce flow, domain restriction, logout.
- `server/src/routes/prompts.ts`: prompt CRUD/version/favorite/rating/usage and list pagination.
- `server/src/routes/collections.ts`: collections CRUD + membership operations with list pagination.
- `server/src/routes/tags.ts`: tags list/create with validation and uniqueness checks.
- `server/test/*`: behavior-level API tests with mocked Prisma and middleware boundaries.

## Replication and Setup

### 1) Install dependencies

```bash
npm --prefix client install
npm --prefix server install
```

### 2) Configure environment

Create `server/.env` (or copy from `.env.example`) and provide values:

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
# Optional auth limiter overrides
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=60
```

Optional frontend env:

```env
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 3) Database setup

```bash
npm --prefix server run prisma:migrate -- --name init
npm --prefix server run prisma:generate
npm --prefix server run prisma:seed
```

### 4) Run locally

```bash
npm --prefix server run dev
npm --prefix client run dev
```

### 5) Test and build checks

```bash
npm --prefix server test
npm --prefix server run build
npm --prefix client run build
```

### 6) Deploy to Heroku

```bash
git push heroku main
```

Release process is defined in `Procfile` (`release` runs Prisma deploy, `web` starts server).

## Maintenance Mode

### TODO/FIXME Scan

- Scanned repository for `TODO` and `FIXME`.
- No application-code TODO/FIXME markers were found in tracked source files.
- One TODO/FIXME mention exists in policy/rule documentation (`.cursor/rules/commit-deploy-update-summary.mdc`) as an instruction, not as unresolved code work.

### Roadmap / Backlog

- Expand integration tests to include non-happy-path OAuth callback exchange and DB errors.
- Add frontend tests (Vitest + RTL) for critical prompt/collection/auth views.
- Add API contract documentation (OpenAPI/Swagger) for route request/response schemas.
- Add production observability (structured logs + error tracking).
- Add query/index performance tuning once data volume grows.
