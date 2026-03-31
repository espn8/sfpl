# Prompt Library - Technical Summary

**Last Updated:** Tuesday, March 31, 2026 at 21:26 UTC  
**Build Version:** 6ba7659  
**Environment:** Production (Heroku)  
**Deployment Status:** v19 - Deployed and Active  
**Health Check:** ✅ `{"ok":true}`

---

## Recent Changes

### Frontend Architecture Refactoring (Current Session - March 31, 2026)
- **Feature-Based Component Structure**: Refactored monolithic 400+ line `router.tsx` into modular feature-based architecture
  - Created `features/prompts/` with `PromptListPage`, `PromptEditorPage`, `PromptDetailPage` components
  - Created `features/collections/CollectionsPage.tsx` for collection management
  - Created `features/analytics/AnalyticsPage.tsx` for analytics dashboard
  - Created `features/auth/LoginPage.tsx` for authentication
  - Created shared components: `components/AppShell.tsx` and `components/ProtectedRoute.tsx`
  - Reduced `app/router.tsx` from 400+ to ~50 lines with clean imports
- **Code Organization**: Follows frontend architecture rule with proper separation of concerns, single responsibility, and feature-based organization

### Backend Feature Completion (Current Session - March 31, 2026)
- **Tags API**: Implemented complete tags endpoint
  - Created `server/src/routes/tags.ts` with GET and POST endpoints
  - Team-scoped tag creation with uniqueness validation
  - Tag usage statistics (prompt count per tag)
  - Created `client/src/features/tags/api.ts` for frontend integration
- **Error Handling**: Added centralized error handling middleware
  - Created `server/src/middleware/errorHandler.ts`
  - Unified error response format with code, message, and optional details
  - Development-mode error stack traces for debugging
- **Database Seeding**: Comprehensive seed script for development and testing
  - Created `server/prisma/seed.ts` with demo team, users, prompts, tags, collections
  - Includes sample ratings, favorites, and usage events for realistic testing
  - Added `prisma:seed` npm script to `server/package.json`
  - Respects `SEED_ADMIN_EMAIL` environment variable for admin user setup

### Documentation Enhancement (Current Session - March 31, 2026)
- **README Expansion**: Added comprehensive feature list, API endpoint reference, and complete tech stack details
- **Seeding Instructions**: Documented database seed process with optional admin email configuration
- **API Documentation**: Complete endpoint reference for all routes (auth, prompts, tags, collections, analytics)

### Connection Pooling & Session Persistence (Previous Session - March 30, 2026)
- **PostgreSQL Connection Pool**: Added dedicated connection pool for session storage
  - Configured pg.Pool with max 5 connections, 60s idle timeout, 30s connection timeout
  - Eliminates repeated SSL handshakes and reduces latency from 15-20s to <2s
- **PostgreSQL Session Store**: Migrated from MemoryStore to connect-pg-simple
  - Sessions persist across dyno restarts and shared across multiple dynos
  - Production-ready session management with automatic table creation
  - Resolved OAuth callback timeout issues (reduced from 5+ seconds to <3 seconds)

### Authentication & Security (Previous Sessions)
- **Restricted Domain Access**: Enforced @salesforce.com email domain restriction for all user authentication
- **Google OAuth SSO**: Complete OpenID Connect authentication flow with state/nonce validation
- **Session Management**: HttpOnly cookie-based sessions with 7-day expiration
- **Prisma Schema**: Complete data model with 12 models covering prompts, teams, collections, tags, ratings, favorites, and usage tracking

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
│   │   ├── api/
│   │   │   └── client.ts               # Axios singleton with interceptors
│   │   ├── app/
│   │   │   ├── analytics.ts            # GA4 tracking utilities
│   │   │   └── router.tsx              # React Router configuration (~50 lines)
│   │   ├── assets/                     # Images, fonts, etc.
│   │   ├── components/
│   │   │   ├── AppShell.tsx            # Main layout with navigation
│   │   │   └── ProtectedRoute.tsx      # Authentication guard wrapper
│   │   ├── features/                   # Feature-based modules
│   │   │   ├── analytics/
│   │   │   │   ├── AnalyticsPage.tsx   # Analytics dashboard component
│   │   │   │   └── api.ts              # Analytics API client
│   │   │   ├── auth/
│   │   │   │   ├── LoginPage.tsx       # Google OAuth login UI
│   │   │   │   └── api.ts              # Auth API client (login, logout, me)
│   │   │   ├── collections/
│   │   │   │   ├── CollectionsPage.tsx # Collection management UI
│   │   │   │   └── api.ts              # Collections API client
│   │   │   ├── prompts/
│   │   │   │   ├── PromptListPage.tsx  # Prompt discovery with filters
│   │   │   │   ├── PromptDetailPage.tsx# Prompt detail with actions
│   │   │   │   ├── PromptEditorPage.tsx# Prompt creation form
│   │   │   │   └── api.ts              # Prompts API client
│   │   │   └── tags/
│   │   │       └── api.ts              # Tags API client
│   │   ├── pages/
│   │   │   ├── PrivacyPage.tsx         # Privacy policy page
│   │   │   └── TermsPage.tsx           # Terms of service page
│   │   └── main.tsx                    # App entry point with providers
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/                             # Express + Prisma backend
│   ├── prisma/
│   │   ├── migrations/                 # Prisma migration history
│   │   │   └── 20260327120000_phase1_sso_ga/
│   │   ├── schema.prisma               # Database schema (12 models)
│   │   └── seed.ts                     # Database seed script with demo data
│   ├── public/                         # Compiled client build (generated)
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts                  # Environment variable validation
│   │   ├── lib/
│   │   │   └── prisma.ts               # Prisma client singleton (cached)
│   │   ├── middleware/
│   │   │   ├── auth.ts                 # requireAuth, requireRole, getAuthContext
│   │   │   └── errorHandler.ts         # Centralized error handling
│   │   ├── routes/
│   │   │   ├── analytics.ts            # Analytics overview endpoint
│   │   │   ├── auth.ts                 # Google OAuth flow with domain restriction
│   │   │   ├── collections.ts          # Collection CRUD + prompt membership
│   │   │   ├── prompts.ts              # Prompt CRUD, versions, engagement
│   │   │   └── tags.ts                 # Tag CRUD with team scoping
│   │   ├── types/
│   │   │   └── express-session.d.ts    # Session type extensions
│   │   └── index.ts                    # Express app bootstrap with connection pool
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
- **`server/src/middleware/auth.ts`**: Request authentication middleware (`requireAuth`, `requireRole`), and helper (`getAuthContext`).
- **`server/src/middleware/errorHandler.ts`**: Centralized Express error handler with development-mode stack traces.
- **`server/src/routes/tags.ts`**: Tag CRUD endpoints with team scoping and prompt count statistics.
- **`server/prisma/seed.ts`**: Database seed script creating demo team, users, prompts, tags, collections, and engagement data.

#### Frontend Core Modules

- **`client/src/api/client.ts`**: Axios singleton with credentials support and withCredentials configuration.
- **`client/src/app/router.tsx`**: React Router v7 configuration with protected routes and route-based page view tracking.
- **`client/src/app/analytics.ts`**: Google Analytics 4 integration utilities (trackEvent, trackPageView).
- **`client/src/components/AppShell.tsx`**: Main application layout with navigation header and logout functionality.
- **`client/src/components/ProtectedRoute.tsx`**: Authentication guard that redirects unauthenticated users to login.
- **`client/src/features/auth/`**: Login page with Google OAuth button and links to terms/privacy pages.
- **`client/src/features/prompts/`**: Complete prompt lifecycle - list page with filtering, detail page with copy/launch/rating, editor page for creation.
- **`client/src/features/collections/`**: Collection management with creation and listing functionality.
- **`client/src/features/analytics/`**: Analytics dashboard showing top used prompts and stale prompt detection.
- **`client/src/features/tags/`**: Tag API client for tag listing and creation (UI integration pending).

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

6. **Seed database (optional)**:
   ```bash
   # Use default admin email (admin@example.com)
   npm --prefix server run prisma:seed
   
   # Or set custom admin email
   SEED_ADMIN_EMAIL=your.email@salesforce.com npm --prefix server run prisma:seed
   ```
   
   Creates:
   - Demo team (slug: `demo-team`)
   - Admin user and team member
   - Sample prompts with tags and versions
   - Starter collection with prompts
   - Sample favorites, ratings, and usage events

7. **Start development servers**:
   ```bash
   # Terminal 1 - Backend
   npm --prefix server run dev

   # Terminal 2 - Frontend
   npm --prefix client run dev
   ```

8. **Access application**:
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

- [x] `GET /api/health` returns `{ ok: true }`
- [x] Google OAuth flow completes successfully
- [x] Non-@salesforce.com email rejected with 403
- [x] Authenticated user can access `GET /api/auth/me`
- [x] Prompt creation and retrieval works
- [x] Session persists across page reloads and dyno restarts (PostgreSQL session store)
- [x] Logout clears session and cookie
- [x] Tags API endpoints functional
- [x] Collections API endpoints functional
- [x] Analytics overview endpoint functional

---

## Roadmap & Backlog

### Completed (MVP v1.0)

1. **Frontend Implementation**:
   - [x] Prompt discovery page with search/filter/sort
   - [x] Prompt detail page with copy/launch actions
   - [x] Prompt editor with basic form
   - [x] Collection management UI
   - [x] Analytics dashboard with top used and stale prompts
   - [x] Feature-based component architecture
   - [x] Protected routes with authentication guard

2. **Backend Core**:
   - [x] Implement `requireAuth` and `requireRole` middleware
   - [x] Centralized error handling middleware
   - [x] All API endpoints (auth, prompts, collections, tags, analytics)
   - [x] Version history and restore functionality
   - [x] Engagement tracking (favorites, ratings, usage events)

3. **Analytics & Tracking**:
   - [x] Google Analytics 4 integration in frontend
   - [x] Usage event tracking on prompt interactions (view/copy/launch)
   - [x] Stale prompt detection in analytics endpoint
   - [x] Top prompts by usage count

4. **Infrastructure**:
   - [x] PostgreSQL connection pooling for performance
   - [x] PostgreSQL session store for production reliability
   - [x] Database seed script for development and testing
   - [x] Comprehensive documentation (README, IMPLEMENTATION_SPEC, summary)

### Immediate Priorities (Post-MVP)

1. **Backend Hardening**:
   - [ ] Add request body validation with Zod for all routes
   - [ ] Rate limiting on auth endpoints (prevent brute force)
   - [ ] API response pagination for large datasets
   - [ ] Comprehensive integration tests

2. **Frontend Enhancements**:
   - [ ] Tag management UI (create, list, filter by tag)
   - [ ] Prompt markdown preview in editor
   - [ ] Variable interpolation UI with live preview
   - [ ] Collection drag-drop reordering
   - [ ] Version history diff viewer

3. **Documentation**:
   - [ ] API reference (OpenAPI/Swagger spec)
   - [ ] User guide for prompt authoring best practices
   - [ ] Admin guide for team management

### Future Enhancements (v2.0+)

- [ ] Markdown rendering for prompt bodies with syntax highlighting
- [ ] Prompt templates and cloning functionality
- [ ] Advanced search with full-text indexing (PostgreSQL `tsvector`)
- [ ] Export prompts to JSON/CSV
- [ ] Webhook integrations for prompt updates
- [ ] Multi-language support (i18next)
- [ ] Dark mode theme toggle with user preference
- [ ] Real-time collaboration (WebSocket for live editing)
- [ ] API key authentication for programmatic access
- [ ] Prompt usage analytics dashboard with charts (Recharts/D3.js)
- [ ] Team invitation system with email verification
- [ ] Prompt approval workflow for team governance
- [ ] Custom model provider integrations beyond ChatGPT/Claude/Gemini

### Known Issues & Tech Debt

#### High Priority
- **No Error Boundaries**: Frontend needs React error boundaries for graceful failure handling
- **Missing Input Validation**: Backend routes need comprehensive Zod validation for request bodies
- **No Structured Logging**: Server lacks structured logging (consider Winston or Pino for production)
- **No Rate Limiting**: Auth endpoints vulnerable to brute force attacks
- **No Pagination**: API endpoints return all results (will cause performance issues at scale)

#### Medium Priority
- **No Caching**: No Redis/CDN caching for frequently accessed prompts
- **Tailwind Config**: Frontend needs theme customization (colors, fonts, spacing)
- **No Code Splitting**: Frontend bundle not optimized with lazy loading
- **No E2E Tests**: Critical user flows lack automated testing
- **Missing API Documentation**: No OpenAPI/Swagger spec for external integrators

#### Low Priority (Nice to Have)
- **No Dark Mode**: User preference for theme not implemented
- **No Image Optimization**: Static assets not optimized or served from CDN
- **Migration Naming**: Single large migration file could be split for clarity
- **Console Logging**: Some console.log statements should be replaced with proper logging

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
