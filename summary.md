# Prompt Library - Technical Summary

**Last Updated:** Monday, March 30, 2026 at 18:45 UTC  
**Build Version:** 2d465ea  
**Environment:** Production-ready (Heroku)

---

## Recent Changes

### Authentication & Security (Current Session)
- **Restricted Domain Access**: Enforced @salesforce.com email domain restriction for all user authentication
- Updated environment configuration files (`.env`, `.env.example`) to require `GOOGLE_ALLOWED_DOMAIN=salesforce.com`
- Updated deployment documentation (`README.md`, `app.json`) to reflect mandatory domain restriction
- Domain validation logic already implemented in `server/src/routes/auth.ts` (lines 115-118)

### Infrastructure & Architecture (Previous Session)
- **Google OAuth SSO**: Implemented OpenID Connect authentication flow with state/nonce validation
- **Prisma Schema**: Complete data model with 12 models covering prompts, teams, collections, tags, ratings, favorites, and usage tracking
- **Session Management**: HttpOnly cookie-based sessions with 7-day expiration
- **Heroku Deployment**: Full CI/CD pipeline with release phase migrations via Procfile
- **Frontend Stack**: Added React Query, Axios, React Router Dom for client-side data management
- **Environment Validation**: Centralized env parsing in `server/src/config/env.ts` with fail-fast validation

---

## Technical Architecture

### Core Stack

#### Backend
- **Runtime**: Node.js v25.8.2
- **Framework**: Express v5.2.1
- **Database ORM**: Prisma v6.19.2 with PostgreSQL
- **Authentication**: jose v6.2.2 (JWT verification for Google ID tokens)
- **Session Store**: express-session v1.19.0 with HttpOnly cookies
- **Language**: TypeScript v5.9.3 (strict mode)

#### Frontend
- **Framework**: React v19.2.4 (functional components)
- **Build Tool**: Vite v8.0.1
- **Styling**: Tailwind CSS v4.2.2
- **Data Fetching**: TanStack Query v5.95.2
- **HTTP Client**: Axios v1.14.0
- **Routing**: React Router v7.13.2
- **Language**: TypeScript v5.9.3

#### Database
- **Provider**: Heroku Postgres (PostgreSQL)
- **Migration Tool**: Prisma Migrate
- **Schema**: 12 models with relational integrity and cascading deletes

### Runtime Requirements

- Node.js 20+ (tested on v25.8.2)
- npm 9+ (tested on v11.11.1)
- PostgreSQL 13+ (managed by Heroku Postgres)
- Heroku CLI (for deployment)
- Google Cloud OAuth 2.0 Client (for SSO)

### Third-Party Integrations

| Service | Role | Implementation Location |
|---------|------|------------------------|
| Google OAuth 2.0 | User authentication & SSO | `server/src/routes/auth.ts` |
| Google JWKS | ID token verification | `server/src/routes/auth.ts` (lines 10-12) |
| Heroku Postgres | Primary database | ENV: `DATABASE_URL` |
| Google Analytics (GA4) | Optional frontend analytics | `client/src/main.tsx` (planned) |

---

## Project Blueprint

### Directory Structure

```
.
├── .cursor/
│   └── rules/                          # Cursor AI workspace rules
│       ├── commit-deploy-update-summary.mdc
│       └── frontend-architecture-2026.mdc
├── client/                             # React frontend
│   ├── public/                         # Static assets
│   ├── src/
│   │   ├── api/                        # Axios client & API request modules
│   │   ├── app/                        # App providers & router setup
│   │   ├── assets/                     # Images, fonts, etc.
│   │   ├── features/                   # Feature-based modules
│   │   │   ├── analytics/              # Analytics dashboard components
│   │   │   ├── auth/                   # Auth UI (login, auth context)
│   │   │   ├── collections/            # Collection management UI
│   │   │   └── prompts/                # Prompt discovery, detail, editor
│   │   ├── pages/                      # Route page components
│   │   └── main.tsx                    # App entry point
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                             # Express + Prisma backend
│   ├── prisma/
│   │   ├── migrations/                 # Prisma migration history
│   │   │   └── 20260327120000_phase1_sso_ga/
│   │   └── schema.prisma               # Database schema (12 models)
│   ├── public/                         # Compiled client build (generated)
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts                  # Environment variable validation
│   │   ├── lib/
│   │   │   └── prisma.ts               # Prisma client singleton
│   │   ├── middleware/
│   │   │   └── auth.ts                 # requireAuth, requireRole (WIP)
│   │   ├── routes/
│   │   │   ├── analytics.ts            # Analytics endpoints
│   │   │   ├── auth.ts                 # Google OAuth flow
│   │   │   ├── collections.ts          # Collection CRUD
│   │   │   └── prompts.ts              # Prompt CRUD + engagement
│   │   ├── types/                      # TypeScript type definitions
│   │   └── index.ts                    # Express app bootstrap
│   ├── package.json
│   └── tsconfig.json
├── .gitignore
├── app.json                            # Heroku app manifest
├── IMPLEMENTATION_SPEC.md              # Detailed implementation plan
├── Procfile                            # Heroku process definitions
├── README.md                           # Deployment & setup guide
└── summary.md                          # This file
```

### Data Model Overview

The Prisma schema defines a multi-tenant prompt library with the following entities:

1. **Team**: Organization-level container (auto-created from email domain)
2. **User**: Team members with role-based access (OWNER, ADMIN, MEMBER, VIEWER)
3. **Prompt**: Core entity with title, body, status, visibility, model hints
4. **PromptVersion**: Immutable version history for prompt changes
5. **Tag**: Team-scoped labels for prompt categorization
6. **PromptTag**: Many-to-many join table (Prompt ↔ Tag)
7. **Collection**: Curated prompt groupings with ordering
8. **CollectionPrompt**: Many-to-many join table (Collection ↔ Prompt)
9. **Favorite**: User bookmarks for prompts
10. **Rating**: User ratings (1-5 stars) for prompts
11. **PromptVariable**: Configurable placeholders in prompt bodies
12. **UsageEvent**: Audit log for VIEW, COPY, LAUNCH actions

**Enums**:
- `Role`: OWNER | ADMIN | MEMBER | VIEWER
- `PromptVisibility`: TEAM | PRIVATE
- `PromptStatus`: DRAFT | PUBLISHED | ARCHIVED
- `UsageAction`: VIEW | COPY | LAUNCH

### Data Flow & Lifecycle

#### Authentication Flow
1. User clicks "Continue with Google" → `GET /api/auth/google`
2. Backend generates state/nonce, stores in session, redirects to Google consent screen
3. Google callback → `GET /api/auth/google/callback?code=...&state=...`
4. Backend exchanges code for ID token, verifies JWT signature via Google JWKS
5. Backend validates nonce, email_verified claim, and domain restriction (`@salesforce.com`)
6. Backend upserts User and Team, stores auth session in cookie
7. User redirected to frontend with authenticated session

#### Prompt Lifecycle
1. **Create**: `POST /api/prompts` → Draft status, team-scoped
2. **Edit**: `PATCH /api/prompts/:id` → Updates body, optionally creates PromptVersion
3. **Publish**: `PATCH /api/prompts/:id` with `status: PUBLISHED`
4. **Tag**: `POST /api/tags` + associate via PromptTag join table
5. **Collect**: `POST /api/collections/:id/prompts/:promptId`
6. **Engage**: User views/copies/launches → `POST /api/prompts/:id/usage`
7. **Rate/Favorite**: `POST /api/prompts/:id/rating` or `/favorite` (toggle)
8. **Archive**: `PATCH /api/prompts/:id` with `status: ARCHIVED` (soft delete)

#### Request Pipeline (Express Middleware Chain)
1. CORS validation (`cors` middleware)
2. Cookie parsing (`cookie-parser`)
3. Session deserialization (`express-session`)
4. JSON body parsing (`express.json()`)
5. Route handler (with optional `requireAuth` middleware)
6. Response serialization
7. Error handler (centralized error middleware - planned)

### Module Responsibilities

#### Backend Core Modules

- **`server/src/config/env.ts`**: Environment variable parsing, validation, and typing. Fails fast on missing required vars.
- **`server/src/lib/prisma.ts`**: Singleton Prisma client instance. Prevents multiple connections in dev hot-reload.
- **`server/src/routes/auth.ts`**: Google OAuth 2.0 flow, ID token verification, session creation, domain restriction enforcement.
- **`server/src/routes/prompts.ts`**: Prompt CRUD, filtering, sorting, engagement tracking (favorite/rating/usage).
- **`server/src/routes/collections.ts`**: Collection CRUD, prompt association with sort order.
- **`server/src/routes/analytics.ts`**: Team-level analytics (top prompts, stale prompts, contributor leaderboard).
- **`server/src/middleware/auth.ts`**: Request authentication middleware (`requireAuth`, `requireRole`).

#### Frontend Core Modules (Planned)

- **`client/src/api/client.ts`**: Axios singleton with request/response interceptors, CSRF token handling, auth header attachment.
- **`client/src/app/router.tsx`**: React Router v6 configuration with protected routes.
- **`client/src/features/auth/`**: Login page, auth context provider, sign-out logic.
- **`client/src/features/prompts/`**: Discovery page, prompt detail, prompt editor, version history UI.
- **`client/src/features/collections/`**: Collection list, collection detail with drag-drop reordering.
- **`client/src/features/analytics/`**: Dashboard with top prompts, usage charts, stale prompt alerts.

---

## Replication & Setup

### Prerequisites

- Node.js 20+ and npm 9+
- PostgreSQL 13+ (local) or Heroku Postgres (production)
- Google Cloud OAuth 2.0 Client (create at https://console.cloud.google.com)
- Heroku CLI (for production deployment)

### Local Development Setup

1. **Clone repository**:
   ```bash
   git clone <repo-url>
   cd promptlibrary
   ```

2. **Install dependencies**:
   ```bash
   npm --prefix client install
   npm --prefix server install
   ```

3. **Configure environment**:
   ```bash
   cp server/.env.example server/.env
   ```

   Edit `server/.env` with required values:
   ```env
   NODE_ENV=development
   PORT=5000
   DATABASE_URL=postgresql://username@localhost:5432/promptlibrary
   CORS_ORIGIN=http://localhost:5173
   APP_BASE_URL=http://localhost:5173
   SESSION_SECRET=generate-long-random-string-here
   COOKIE_SECURE=false
   SESSION_SAME_SITE=lax
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   GOOGLE_ALLOWED_DOMAIN=salesforce.com
   ```

   Optional client analytics:
   ```bash
   echo "VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX" > client/.env
   ```

4. **Setup Google OAuth**:
   - In Google Cloud Console → APIs & Services → Credentials
   - Create OAuth 2.0 Client ID (Web application)
   - Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
   - Copy Client ID and Secret to `server/.env`

5. **Initialize database**:
   ```bash
   npm --prefix server run prisma:migrate -- --name init
   npm --prefix server run prisma:generate
   ```

6. **Start development servers**:
   ```bash
   # Terminal 1 - Backend
   npm --prefix server run dev

   # Terminal 2 - Frontend
   npm --prefix client run dev
   ```

7. **Access application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000/api
   - Health check: http://localhost:5000/api/health

### Production Deployment (Heroku)

1. **Create Heroku app**:
   ```bash
   heroku create your-app-name
   heroku addons:create heroku-postgresql:essential-0
   ```

2. **Configure environment variables**:
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set CORS_ORIGIN=http://sfpl.mysalesforcedemo.com
   heroku config:set APP_BASE_URL=http://sfpl.mysalesforcedemo.com
   heroku config:set SESSION_SECRET=$(openssl rand -base64 32)
   heroku config:set COOKIE_SECURE=true
   heroku config:set SESSION_SAME_SITE=lax
   heroku config:set GOOGLE_CLIENT_ID=<production-client-id>
   heroku config:set GOOGLE_CLIENT_SECRET=<production-client-secret>
   heroku config:set GOOGLE_CALLBACK_URL=http://sfpl.mysalesforcedemo.com/api/auth/google/callback
   heroku config:set GOOGLE_ALLOWED_DOMAIN=salesforce.com
   heroku config:set VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```

3. **Update Google OAuth**:
   - Add production redirect URI: `http://sfpl.mysalesforcedemo.com/api/auth/google/callback`

4. **Deploy**:
   ```bash
   git push heroku main
   ```

   The `Procfile` defines two processes:
   - `release`: Runs Prisma migrations via `npm --prefix server run prisma:deploy`
   - `web`: Starts Express server via `npm --prefix server run start`

   The `heroku-postbuild` script in `server/package.json` automatically:
   - Builds client with `npm --prefix ../client run build`
   - Copies `client/dist` to `server/public`

5. **Verify deployment**:
   ```bash
   heroku open
   curl https://your-app.herokuapp.com/api/health
   ```

### Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | - | Runtime environment (`development` or `production`) |
| `PORT` | No | 5000 | HTTP server port (Heroku sets dynamically) |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `CORS_ORIGIN` | Yes | - | Allowed frontend origin for CORS |
| `APP_BASE_URL` | Yes | - | Canonical app URL for redirects |
| `SESSION_SECRET` | Yes | - | Secret for signing session cookies (min 32 chars) |
| `COOKIE_SECURE` | No | false | Set `true` in production (HTTPS only) |
| `SESSION_SAME_SITE` | No | lax | Cookie SameSite policy (`lax`, `strict`, `none`) |
| `GOOGLE_CLIENT_ID` | Yes | - | Google OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | - | Google OAuth 2.0 client secret |
| `GOOGLE_CALLBACK_URL` | Yes | - | OAuth redirect URI |
| `GOOGLE_ALLOWED_DOMAIN` | Yes | - | Restrict login to email domain (set to `salesforce.com`) |
| `VITE_GA_MEASUREMENT_ID` | No | - | Google Analytics 4 measurement ID (frontend) |

---

## Security & Authorization

### Authentication Security

- **OAuth State/Nonce Validation**: Prevents CSRF attacks on OAuth callback
- **JWT Signature Verification**: ID tokens verified against Google JWKS endpoint
- **Email Verification Required**: Rejects Google accounts with unverified emails
- **Domain Restriction**: Enforces `@salesforce.com` email domain via `GOOGLE_ALLOWED_DOMAIN`
- **Session-Only Storage**: No user data in JWT; only session ID in HttpOnly cookie

### Authorization Model

- **Team Scoping**: All data queries filtered by `teamId` from authenticated session
- **Role-Based Access**: OWNER > ADMIN > MEMBER > VIEWER (middleware enforcement planned)
- **Ownership Rules**:
  - Prompt owner can edit/delete own prompts
  - Admins can edit/delete any team prompt
  - Members can view TEAM prompts, create new prompts
  - Viewers have read-only access

### Data Protection

- **HttpOnly Cookies**: Session cookies inaccessible to JavaScript (XSS mitigation)
- **Secure Cookies**: Production cookies require HTTPS (`COOKIE_SECURE=true`)
- **SameSite Cookies**: Prevents CSRF attacks (`SESSION_SAME_SITE=lax`)
- **Secrets Management**: No hardcoded secrets; all via environment variables
- **Database Isolation**: Soft deletes via `ARCHIVED` status; cascading deletes on foreign keys

---

## Testing Strategy

### Current Status
- **Unit Tests**: Not implemented
- **Integration Tests**: Not implemented
- **E2E Tests**: Not implemented
- **Manual Testing**: Active (smoke tests on deploy)

### Planned Testing

- **Backend Unit**: Vitest for utility functions, Zod validators
- **Backend Integration**: Supertest for API endpoint contracts
- **Frontend Unit**: Vitest for hooks, utility functions
- **Frontend Component**: React Testing Library for UI components
- **E2E**: Playwright for critical user flows (auth, prompt CRUD, collections)

### Smoke Test Checklist (Manual)

- [ ] `GET /api/health` returns `{ ok: true }`
- [ ] Google OAuth flow completes successfully
- [ ] Non-@salesforce.com email rejected with 403
- [ ] Authenticated user can access `GET /api/auth/me`
- [ ] Prompt creation and retrieval works
- [ ] Session persists across page reloads
- [ ] Logout clears session and cookie

---

## Roadmap & Backlog

### Immediate Priorities (MVP Completion)

1. **Frontend Implementation**:
   - [ ] Prompt discovery page with search/filter/sort
   - [ ] Prompt detail page with copy/launch actions
   - [ ] Prompt editor with markdown preview
   - [ ] Collection management UI
   - [ ] Analytics dashboard

2. **Backend Hardening**:
   - [ ] Implement `requireAuth` and `requireRole` middleware
   - [ ] Add request body validation with Zod
   - [ ] Centralized error handling middleware
   - [ ] Rate limiting on auth endpoints

3. **Analytics & Tracking**:
   - [ ] Google Analytics 4 integration in frontend
   - [ ] Usage event tracking on prompt interactions
   - [ ] Stale prompt detection (no usage in 90 days)
   - [ ] Top contributors leaderboard

4. **Documentation**:
   - [ ] API reference (OpenAPI/Swagger spec)
   - [ ] User guide for prompt authoring
   - [ ] Admin guide for team management

### Future Enhancements

- [ ] Prompt variable interpolation UI with live preview
- [ ] One-click launch URLs for ChatGPT/Claude/Gemini
- [ ] Markdown rendering for prompt bodies
- [ ] Prompt templates and cloning
- [ ] Advanced search with full-text indexing (PostgreSQL `tsvector`)
- [ ] Export prompts to JSON/CSV
- [ ] Webhook integrations for prompt updates
- [ ] Multi-language support (i18next)
- [ ] Dark mode theme toggle
- [ ] Prompt version diff viewer
- [ ] Real-time collaboration (WebSocket)
- [ ] API key authentication for programmatic access

### Known Issues & Tech Debt

- **No Error Boundaries**: Frontend needs error boundaries for graceful failure
- **Missing Input Validation**: Backend routes lack comprehensive Zod validation
- **No Logging**: Server lacks structured logging (consider Winston or Pino)
- **Session Store**: Uses in-memory store (not suitable for multi-dyno Heroku; migrate to Redis)
- **No Caching**: No Redis/CDN caching for frequently accessed prompts
- **Tailwind Config**: Frontend needs theme customization (colors, fonts)
- **TypeScript Strictness**: Some `any` types in route handlers need cleanup
- **Migration Naming**: Single migration file should be split for clarity

---

## Performance Considerations

### Current Performance Profile

- **Cold Start**: ~2-3 seconds (Heroku free/hobby dynos)
- **API Latency**: <100ms for simple queries (local network)
- **Database**: No indexing optimization yet (all Prisma defaults)
- **Frontend Bundle**: No code splitting (single bundle)
- **Static Assets**: Served from Express (no CDN)

### Optimization Roadmap

1. **Database Indexing**: Add composite indexes on frequently queried fields (teamId + status)
2. **Query Optimization**: Use Prisma `include` selectively to avoid N+1 queries
3. **Caching Layer**: Redis for session store and frequently accessed prompts
4. **CDN Integration**: Cloudflare or Fastly for static assets
5. **Code Splitting**: Lazy load routes with React.lazy()
6. **Image Optimization**: Use Next.js Image or similar for avatars
7. **Connection Pooling**: Configure Prisma connection pool for production load

---

## Monitoring & Observability

### Current Status
- **Logging**: Console.log only
- **Monitoring**: Heroku metrics dashboard
- **Alerts**: None configured
- **APM**: Not implemented

### Planned Observability

- **Structured Logging**: Winston or Pino with JSON output
- **Error Tracking**: Sentry for backend and frontend exceptions
- **APM**: Datadog or New Relic for request tracing
- **Uptime Monitoring**: UptimeRobot or Pingdom for health check
- **Database Monitoring**: Heroku Postgres metrics + slow query logs

---

## Maintenance & Operations

### Deployment Cadence
- **Current**: Manual deploys via `git push heroku main`
- **Planned**: CI/CD pipeline (GitHub Actions) with automated tests

### Backup Strategy
- **Database**: Heroku Postgres automated backups (daily)
- **Configuration**: Environment variables documented in `app.json`
- **Code**: Git repository (origin: GitHub)

### Rollback Procedure
1. Identify last stable release: `heroku releases`
2. Rollback: `heroku rollback v<N>`
3. Verify health: `heroku logs --tail` + smoke tests

### Database Migrations
- **Development**: `npm --prefix server run prisma:migrate -- --name <name>`
- **Production**: Automatic via Heroku release phase (`Procfile` release command)
- **Rollback**: Manual SQL or Prisma migrate rollback (exercise caution)

---

## Contact & Support

- **Repository**: [GitHub Repository URL - TBD]
- **Maintainer**: [Team/Individual - TBD]
- **Documentation**: See `README.md` and `IMPLEMENTATION_SPEC.md`
- **Issues**: [GitHub Issues URL - TBD]

---

## Appendix: Key Files Reference

| File Path | Purpose |
|-----------|---------|
| `server/src/index.ts` | Express app bootstrap, middleware chain, route mounting |
| `server/src/routes/auth.ts` | Google OAuth flow, domain restriction (lines 115-118) |
| `server/src/config/env.ts` | Environment variable validation and typing |
| `server/prisma/schema.prisma` | Complete database schema (12 models) |
| `server/.env.example` | Environment variable template |
| `client/index.html` | HTML entry point with Salesforce favicon |
| `Procfile` | Heroku process definitions (release + web) |
| `app.json` | Heroku app manifest with default config values |
| `README.md` | Deployment and setup instructions |
| `IMPLEMENTATION_SPEC.md` | Detailed implementation specification |

---

**End of Summary**
