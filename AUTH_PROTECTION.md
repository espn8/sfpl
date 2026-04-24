# Authentication Protection Summary

This document describes how SSO authentication protection is implemented across the AI Library application.

## Overview

All site content requires Google SSO authentication **except** for:
- `/login` - Login page with Google SSO button
- `/terms` - Terms of Service page
- `/privacy` - Privacy Policy page

## Server-Side Protection

### Public API Endpoints
The following API endpoints are accessible without authentication:
- `GET /api/health` - Health check endpoint
- `GET /api/auth/google` - Initiates Google OAuth flow
- `GET /api/auth/google/callback` - OAuth callback handler
- `GET /api/auth/google/start` - Alternative Google OAuth entry point

### Protected API Endpoints
All other API endpoints require authentication via the `requireAuth` middleware:
- `/api/prompts/*` - All prompt CRUD operations
- `/api/skills/*` - All skill CRUD operations
- `/api/context/*` - All context (markdown) document CRUD operations
- `/api/collections/*` - All collection operations
- `/api/analytics/*` - All analytics endpoints
- `GET /api/auth/me` - Current user info
- `POST /api/auth/logout` - Logout endpoint

### Middleware Implementation
Authentication is enforced using the `requireAuth` middleware defined in `server/src/middleware/auth.ts`:
- Checks for valid session in `req.session.auth`
- Returns 401 Unauthorized if session is missing
- Applies to entire router via `router.use(requireAuth)`

## Client-Side Protection

### Public Routes
The following frontend routes are accessible without authentication:
- `/login` - Login page with Google SSO
- `/terms` - Terms of Service
- `/privacy` - Privacy Policy

### Protected Routes
All other routes require authentication and use the `ProtectedRoute` component:
- `/` - Prompt discovery/list
- `/prompts/new` - Create prompt
- `/prompts/:id` - View/edit prompt
- `/skills`, `/skills/new`, `/skills/:id`, `/skills/:id/edit` - Skills
- `/context`, `/context/new`, `/context/:id`, `/context/:id/edit` - Context (markdown)
- `/collections` - Collections list
- `/analytics` - Analytics dashboard

### ProtectedRoute Component
The `ProtectedRoute` wrapper in `client/src/app/router.tsx`:
1. Checks authentication status via `GET /api/auth/me`
2. Displays loading state while checking session
3. Redirects to `/login` if unauthenticated (401)
4. Shows error message for other failures
5. Renders protected content if authenticated

## Session Management

### Server Session
- Session cookie name: `ailibrary.sid`
- HttpOnly, secure in production
- 7-day expiration
- Contains: `userId`, `teamId`, `role`, `userOu`, `onboardingCompleted` (mirrored from the database for gating)

### Client Session
- Managed via TanStack Query
- Query key: `["auth", "me"]`
- Automatic retry disabled for 401 responses
- Invalidated on logout

## User Flow

### First-Time Access
1. User visits any protected route (e.g., `/`)
2. `ProtectedRoute` checks authentication
3. No valid session found → redirect to `/login`
4. User clicks "Continue with Google"
5. Google OAuth flow completes
6. Server creates session (including `onboardingCompleted` from the database) and redirects to `/`
7. If `User.onboardingCompleted` is false, the user **must** finish profile setup before using the app:
   - **Client:** [`AppShell`](client/src/components/AppShell.tsx) shows a blocking welcome dialog (background shell is `inert` / non-interactive until setup completes).
   - **Server:** All authenticated API routers except profile-related auth routes use `requireOnboardingComplete` after `requireAuth`. Requests receive **403** with `error.code: "PROFILE_SETUP_REQUIRED"` until `PATCH /api/auth/me` succeeds.
   - **While incomplete:** `GET /api/auth/me` may archive any **PUBLISHED** prompts, skills, context documents, and builds owned by that user (`ArchiveReason.PROFILE_INCOMPLETE`), once per session, so previously published work is not left live without a completed profile.
8. **Allowed without full onboarding:** `GET /api/auth/me`, `PATCH /api/auth/me`, `POST /api/auth/me/profile-photo`, `POST /api/auth/logout`, and unauthenticated OAuth/health routes. Everything under `/api/prompts`, `/api/skills`, `/api/context`, `/api/builds`, `/api/assets`, `/api/v1/*` (API key), etc. requires completed onboarding.
9. After profile save, `onboardingCompleted` is true and normal access applies.

### Subsequent Visits
1. User visits any route
2. Session cookie automatically sent with request
3. `ProtectedRoute` validates session
4. User proceeds directly to requested content

### Viewing Public Pages
1. User can visit `/terms` or `/privacy` directly
2. No authentication check performed
3. Links back to `/login` provided

## Security Notes

- All API routes are team-scoped (via `teamId` in session)
- Session state/nonce validated during OAuth flow
- Domain restriction available via `GOOGLE_ALLOWED_DOMAIN` env var
- CSRF protection via session-based state parameter
- No sensitive data in client localStorage
- Tokens only in HttpOnly cookies

## Testing Authentication

### Manual Testing
1. Access `/` without authentication → should redirect to `/login`
2. Access `/terms` → should display without authentication
3. Access `/privacy` → should display without authentication
4. Login via Google → should redirect to `/`
5. Access any protected route → should display content
6. Logout → should redirect to `/login`
7. Try accessing API endpoints without auth → should return 401

### API Testing
```bash
# Public endpoint (should work)
curl http://localhost:5000/api/health

# Protected endpoint without auth (should return 401)
curl http://localhost:5000/api/prompts

# Protected endpoint with session cookie (should work)
curl -b "ailibrary.sid=<session-id>" http://localhost:5000/api/prompts
```

## Configuration

### Required Environment Variables
Server (`server/.env`):
- `SESSION_SECRET` - Used to sign session cookies
- `COOKIE_SECURE` - Set to `true` in production
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_CALLBACK_URL` - OAuth callback URL
- `GOOGLE_ALLOWED_DOMAIN` - Optional domain restriction

Client (`client/.env`):
- `VITE_GA_MEASUREMENT_ID` - Google Analytics (optional)

## Future Enhancements

Potential improvements to consider:
- Add rate limiting to public endpoints
- Implement session refresh token rotation
- Add 2FA support
- Add "Remember me" option
- Add session timeout warnings
- Add concurrent session management
- Add SSO with other providers (Microsoft, Okta, etc.)
