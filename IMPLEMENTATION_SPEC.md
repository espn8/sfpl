# Prompt Library - Concrete Implementation Spec

This spec is tailored to the current repository structure:

- `client/` - React + Vite + TypeScript
- `server/` - Express + TypeScript + Prisma
- Existing Prisma model: `User`
- Existing server entry: `server/src/index.ts`

Objective: build an internal team Prompt Library app, deployed to Heroku, inspired by PromptMagic-style discovery and sharing while focused on team collaboration.

---

## 1) Target Architecture (Repo-Specific)

### Runtime
- Single Heroku web dyno running `server` (`node dist/index.js`)
- `server` statically serves the built `client` bundle from `server/public`
- API namespace under `/api/*`

### Data
- Heroku Postgres
- Prisma as ORM/migrations/client

### Auth (MVP recommendation)
- Google SSO (OpenID Connect) as primary sign-in
- Session cookie auth using HttpOnly cookie after Google callback
- Team-scoped authorization on all prompt resources

---

## 2) Environment and Configuration

Add/standardize these environment variables in `server/.env` and Heroku config vars:

- `NODE_ENV` (`development` | `production`)
- `PORT` (provided by Heroku at runtime)
- `DATABASE_URL` (Heroku Postgres)
- `CORS_ORIGIN` (frontend origin; do not hardcode)
- `SESSION_SECRET`
- `COOKIE_SECURE` (`true` in production)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` (example: `http://sfpl.mysalesforcedemo.com/api/auth/google/callback`)
- `GOOGLE_ALLOWED_DOMAIN` (optional; restrict access to company domain)

Frontend analytics vars:
- `VITE_GA_MEASUREMENT_ID`

Optional:
- `SEED_ADMIN_EMAIL`

Implementation notes:
- Replace hardcoded `allowedOrigin` in `server/src/index.ts` with `process.env.CORS_ORIGIN`.
- Add startup validation that fails fast when required vars are missing.

---

## 3) Prisma Data Model (Concrete v1)

Extend `server/prisma/schema.prisma` with the models below. Keep `User` but add relationships/fields.

### Enums
- `Role`: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`
- `PromptVisibility`: `TEAM`, `PRIVATE`
- `PromptStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `UsageAction`: `VIEW`, `COPY`, `LAUNCH`

### Models

1. `Team`
- `id Int @id @default(autoincrement())`
- `name String`
- `slug String @unique`
- timestamps

2. `User` (update existing)
- keep `id`, `email`, timestamps
- add `name String?`
- add `passwordHash String`
- add `teamId Int`
- relation to `Team`
- optional role shortcut `role Role @default(MEMBER)`

3. `Collection`
- `id`, `teamId`, `name`, `description?`, `createdById`
- timestamps
- unique composite: `@@unique([teamId, name])`

4. `Prompt`
- `id`, `teamId`, `ownerId`
- `title String`
- `summary String?`
- `body String` (latest published/current body)
- `visibility PromptVisibility @default(TEAM)`
- `status PromptStatus @default(DRAFT)`
- `modelHint String?` (e.g. claude/chatgpt/gemini)
- `modality String?` (text/image/video/code)
- timestamps

5. `PromptVersion`
- `id`, `promptId`, `version Int`, `body String`, `changelog String?`, `createdById`, `createdAt`
- unique composite: `@@unique([promptId, version])`

6. `Tag`
- `id`, `teamId`, `name`
- unique composite: `@@unique([teamId, name])`

7. `PromptTag`
- join table: `promptId`, `tagId`
- unique composite: `@@unique([promptId, tagId])`

8. `CollectionPrompt`
- join table: `collectionId`, `promptId`, `sortOrder Int @default(0)`
- unique composite: `@@unique([collectionId, promptId])`

9. `Favorite`
- `userId`, `promptId`, `createdAt`
- unique composite: `@@unique([userId, promptId])`

10. `Rating`
- `userId`, `promptId`, `value Int` (1-5), `createdAt`, `updatedAt`
- unique composite: `@@unique([userId, promptId])`

11. `PromptVariable`
- `id`, `promptId`, `key String`, `label String?`, `defaultValue String?`, `required Boolean @default(false)`
- unique composite: `@@unique([promptId, key])`

12. `UsageEvent`
- `id`, `promptId`, `userId`, `action UsageAction`, `createdAt`
- index: `@@index([promptId, action, createdAt])`

---

## 4) API Contract (Express, `/api`)

Implement under new route modules in `server/src/routes`.

### Auth
- `GET /api/auth/google` (redirect to Google consent)
- `GET /api/auth/google/callback` (OIDC callback)
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Prompts
- `GET /api/prompts`
  - Query: `q`, `tag`, `collectionId`, `status`, `sort` (`recent|topRated|mostUsed`)
- `POST /api/prompts`
- `GET /api/prompts/:id`
- `PATCH /api/prompts/:id`
- `DELETE /api/prompts/:id` (soft delete -> archived preferred)

### Prompt versions
- `GET /api/prompts/:id/versions`
- `POST /api/prompts/:id/versions` (creates new version and updates current `body`)
- `POST /api/prompts/:id/restore/:version`

### Tags
- `GET /api/tags`
- `POST /api/tags`

### Collections
- `GET /api/collections`
- `POST /api/collections`
- `PATCH /api/collections/:id`
- `POST /api/collections/:id/prompts/:promptId`
- `DELETE /api/collections/:id/prompts/:promptId`

### Engagement
- `POST /api/prompts/:id/favorite` (toggle)
- `POST /api/prompts/:id/rating` body `{ value: 1..5 }`
- `POST /api/prompts/:id/usage` body `{ action: "VIEW"|"COPY"|"LAUNCH" }`

### Analytics (team-level)
- `GET /api/analytics/overview`
  - Returns: top prompts, recently active prompts, stale prompts, contributor leaderboard

### Response shape standard
- Success: `{ data, meta? }`
- Error: `{ error: { code, message, details? } }`

---

## 5) Server Code Structure

Create these directories/files:

- `server/src/config/env.ts` - env parsing/validation
- `server/src/lib/prisma.ts` - singleton Prisma client
- `server/src/lib/auth.ts` - session/token helpers
- `server/src/lib/googleAuth.ts` - Google OAuth/OIDC setup helpers
- `server/src/middleware/auth.ts` - `requireAuth`, `requireRole`
- `server/src/middleware/errorHandler.ts`
- `server/src/routes/*.ts`
- `server/src/services/*.ts` for domain logic
- `server/src/validators/*.ts` (Zod request validation)

Refactor `server/src/index.ts`:
- initialize middlewares (cors/json/cookies/session)
- mount API router at `/api`
- keep static serving fallback for SPA
- centralized error handling middleware

Google SSO implementation notes:
- Verify Google ID token claims (`sub`, `email`, `email_verified`) before session creation.
- Upsert user by Google subject/email and assign `teamId` using domain policy or invite mapping.
- Persist only session identifier in cookie, not raw profile/token payloads.

---

## 6) Frontend Implementation Map

Current frontend is minimal. Implement with current React/Vite setup and add routing.

### Dependencies to add in `client`
- `react-router-dom`
- `@tanstack/react-query`
- `axios`
- `zod`
- `react-hook-form` (optional but recommended)
- `react-ga4`

### Frontend directories
- `client/src/app/` (providers, router setup)
- `client/src/api/` (axios client + request modules)
- `client/src/features/auth/`
- `client/src/features/prompts/`
- `client/src/features/collections/`
- `client/src/features/analytics/`
- `client/src/components/ui/`

### Route map (v1)
- `/login`
- `/` -> prompt discovery/list page
- `/prompts/new`
- `/prompts/:id`
- `/prompts/:id/edit`
- `/collections`
- `/collections/:id`
- `/analytics`
- `/settings` (basic profile/team)

### Core screens (concrete)
1. Discovery page:
- Search input
- Filter chips (tag/model/status/collection)
- Sort dropdown
- Prompt card grid/list

2. Prompt detail:
- Prompt metadata
- Variables form and rendered preview
- Copy button
- Launch links (ChatGPT/Claude/Gemini URL prefill)
- Rating/favorite controls
- Version history tab

3. Prompt editor:
- Title/summary/body
- Tag picker
- Visibility/status
- Variable definitions
- Save draft / Publish

4. Collections:
- Collection list
- Collection detail with ordered prompts

5. Analytics:
- Top copied prompts
- Most viewed last 7/30 days
- Stale prompt list (no usage in N days)

6. Login page:
- "Continue with Google" button
- Optional domain restriction notice

---

## 7) UI Look & Feel + Theming

Design references:
- Product interaction and information architecture should be inspired by [Prompt Magic](https://promptmagic.dev/) patterns: discovery-first layout, high-scanability card collections, and immediate primary actions.
- Brand expression should use Salesforce logo placement in app chrome surfaces (login, top nav, and product header) with consistent spacing and contrast.

### Brand and visual tokens
- Implement tokens in `client/src/styles/` (or equivalent single source of truth) and map all component styling to token usage.
- Use explicit token naming:
  - surfaces: `--color-bg`, `--color-surface`, `--color-surface-muted`, `--color-border`
  - text: `--color-text`, `--color-text-muted`, `--color-text-inverse`
  - actions: `--color-primary`, `--color-primary-hover`, `--color-primary-active`
  - states: `--color-success`, `--color-warning`, `--color-danger`, `--color-info`
- Define Salesforce-aligned palettes for each theme:
  - Dark (default): deep neutral surfaces with Salesforce blue accents for interactive controls.
  - Light: bright neutral surfaces and Salesforce blue hierarchy preserving brand identity.
- Ensure semantic states are readable and distinguishable in both themes.

### Theme modes and persistence
- Supported modes: `dark`, `light`, `system`.
- Default mode is `dark` when no user preference exists.
- `system` must track `prefers-color-scheme` and update when OS theme changes.
- Persist user-selected mode (for example `localStorage`) and apply theme before first paint to avoid flash.
- Expose mode switching in global user-facing controls (settings and/or app shell switcher).

### Component styling rules
- Discovery/list pages:
  - Prioritize search + filter + sort controls near top with clear visual affordances.
  - Keep card density high but readable with consistent spacing, hierarchy, and action placement.
- Prompt cards:
  - Distinct card container (surface/border/elevation tokenized by theme).
  - Metadata legibility for model, modality, rating, and usage.
  - Primary quick actions (`copy`, `launch`, `favorite`) visually obvious without clutter.
- Controls:
  - Filter chips require clear selected/unselected/hover/focus states.
  - Button hierarchy must be consistent (`primary`, `secondary`, `ghost`) across screens.
  - Form fields need visible focus ring and sufficient placeholder/label contrast.

### Accessibility requirements
- Target WCAG AA contrast for body text, key UI controls, and focus indicators in both dark and light modes.
- Never rely on color alone for state communication (include iconography/text/state labels where needed).
- Ensure keyboard-only navigation keeps visible focus and predictable tab order.

### Validation checklist
- Discovery, detail, editor, collections, analytics, and settings screens are visually consistent with token system.
- Salesforce logo remains clear and accessible in both dark and light contexts.
- Dark is first-load default; light and system modes are selectable and persistent.

---

## 8) One-Click Launch URL Strategy

Provide utility function that maps provider to compose URL:

- ChatGPT: prefill in query/textarea route
- Claude: prefill prompt route
- Gemini: prefill prompt route

Because provider URLs change, implement as config-driven map in frontend:
- `client/src/features/prompts/launchProviders.ts`
- fall back to copy-to-clipboard if launch URL unsupported

---

## 9) Security and Authorization Rules

- Every data read/write must enforce `teamId` scope from authenticated user.
- Only owner/admin can archive/delete prompts created by others.
- Ratings/favorites are per-user and team scoped.
- Validate all request bodies with Zod.
- Sanitize/escape any rendered rich content (if markdown rendering is added).
- Enforce `state` + nonce checks for OAuth flow and reject reused/invalid callback state.
- If `GOOGLE_ALLOWED_DOMAIN` is set, reject authenticated users outside that domain.

---

## 9.1) Google Analytics (GA4) Tracking Plan

Use GA4 only for aggregate product analytics; keep PII out of event payloads.

Tracked client events (recommended):
- `prompt_view` `{ prompt_id, source: "list"|"collection"|"search" }`
- `prompt_copy` `{ prompt_id }`
- `prompt_launch` `{ prompt_id, provider: "chatgpt"|"claude"|"gemini" }`
- `prompt_favorite_toggle` `{ prompt_id, favorited: boolean }`
- `prompt_rating_submit` `{ prompt_id, rating_value }`
- `prompt_create` `{ prompt_id }`
- `prompt_publish` `{ prompt_id }`
- `search_execute` `{ query_length, filters_count }`
- `collection_view` `{ collection_id }`

Implementation notes:
- Initialize GA in `client/src/main.tsx` only when `VITE_GA_MEASUREMENT_ID` exists.
- Disable analytics in local development by default.
- Do not send email, name, raw prompt body, or any free-text user input to GA.
- Keep internal product usage metrics in Postgres (`UsageEvent`) for team dashboards; GA is supplemental.

---

## 10) Heroku Deployment Spec

### Build/Run
Use existing `server` scripts as base and ensure these are configured:

- `server/package.json`
  - `heroku-postbuild` builds client and copies into `server/public`
  - `build` compiles server TS
  - `start` runs compiled server

### Procfile (in repo root or server, choose one convention)
- `web: npm --prefix server start`

### Release phase for migrations
- Add Heroku release command:
  - `npm --prefix server run prisma:deploy`
- Add script:
  - `"prisma:deploy": "prisma migrate deploy"`

### Health check
- Keep `GET /api/health` and include DB probe.

---

## 11) Delivery Plan (Ticketized)

### Milestone A - Foundation
1. Env validation and CORS refactor
2. Prisma schema expansion + initial migration
3. Google SSO routes + session middleware
4. Base API router + error handling

Acceptance:
- User can sign in with Google, establish session, and logout
- `teamId` exists for authenticated user

### Milestone B - Prompt Core
5. Prompt CRUD + list filters
6. Tags + collections CRUD
7. Favorite/rating/usage endpoints
8. Prompt versions create/list/restore

Acceptance:
- User can create prompt, tag it, add to collection, rate/favorite, and restore older version

### Milestone C - Frontend Core
9. App router + authenticated layout
10. Discovery screen with filters/sort
11. Prompt detail + copy/launch/variables
12. Prompt editor + version creation
13. Collections screens
14. Theme provider + tokenized UI foundation (`dark` default, `light`, `system`)
15. Global theme switch controls + persistence behavior

Acceptance:
- End-to-end prompt lifecycle works in UI
- User can switch `dark`, `light`, `system` from settings/global UI
- First load uses `dark` when no preference exists
- `system` mode tracks device theme changes

### Milestone D - Analytics + Hardening
16. Analytics endpoints + dashboard
17. Authorization hardening and role checks
18. QA pass + seed script + deployment docs, including cross-theme accessibility checks

Acceptance:
- Team can see top prompts and stale prompts
- App deploys cleanly to Heroku with migrations
- Core screens meet contrast and focus visibility requirements in both dark and light themes

---

## 12) Definition of Done

- All v1 endpoints implemented and validated
- Team-scoped authorization on every protected endpoint
- Frontend supports create/discover/use/version workflows
- Frontend theme system supports `dark` (default), `light`, and `system` with persisted user preference
- Theme is applied on initial load without visible flash
- Core interactive components have keyboard-visible focus and WCAG AA contrast in both themes
- Prisma migrations applied in Heroku release phase
- Basic smoke tests pass:
  - auth flow
  - prompt CRUD
  - rating/favorite
  - copy/launch event logging
  - analytics overview

---

## 13) Immediate Next Files to Create/Modify

Server:
- `server/prisma/schema.prisma` (expand models)
- `server/src/index.ts` (refactor bootstrap/cors/env)
- `server/src/config/env.ts`
- `server/src/routes/auth.ts`
- `server/src/routes/prompts.ts`
- `server/src/routes/collections.ts`
- `server/src/routes/analytics.ts`
- `server/src/middleware/auth.ts`
- `server/src/middleware/errorHandler.ts`

Client:
- `client/src/main.tsx` (providers/router)
- `client/src/app/router.tsx`
- `client/src/app/providers/ThemeProvider.tsx`
- `client/src/components/ui/ThemeModeToggle.tsx`
- `client/src/api/client.ts`
- `client/src/styles/tokens.css`
- `client/src/styles/theme.css`
- `client/src/features/prompts/*`
- `client/src/features/collections/*`
- `client/src/features/auth/*`
- `client/src/features/analytics/*`

Ops:
- `Procfile`
- deployment section in root `README.md` (to add)

