# Prompt Library (Heroku Deployment)

This repository contains:

- `client/` - React + Vite frontend
- `server/` - Express + Prisma backend

The backend serves the built frontend from `server/public`.

## Prerequisites

- Node.js 20+
- Heroku CLI
- A Google Cloud OAuth client
- Heroku Postgres addon

## Local setup

1. Install dependencies:
   - `npm --prefix client install`
   - `npm --prefix server install`
2. Copy env template:
   - `cp server/.env.example server/.env`
3. Set required values in `server/.env`:
   - `DATABASE_URL`
   - `CORS_ORIGIN`
   - `APP_BASE_URL`
   - `SESSION_SECRET`
   - `SESSION_SAME_SITE`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL`
4. Add client analytics env:
   - `echo "VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX" > client/.env`
5. Run Prisma migration locally:
   - `npm --prefix server run prisma:migrate -- --name init_google_auth`
6. Seed the database (optional):
   - `npm --prefix server run prisma:seed`
   - Creates demo team, admin user, sample prompts, tags, and collections
   - Set `SEED_ADMIN_EMAIL` in `.env` to use your email
7. Start apps:
   - Backend: `npm --prefix server run dev`
   - Frontend: `npm --prefix client run dev`

## Google OAuth configuration

In Google Cloud Console, configure OAuth consent and add the callback URL:

- Local: `http://localhost:5000/api/auth/google/callback`
- Production: `http://sfpl.mysalesforcedemo.com/api/auth/google/callback`

Domain restriction is enabled to allow only @salesforce.com email addresses:

- `GOOGLE_ALLOWED_DOMAIN=salesforce.com`

## Heroku setup

1. Create app and Postgres:
   - `heroku create <your-app-name>`
   - `heroku addons:create heroku-postgresql:essential-0`
2. Set config vars:
   - `heroku config:set NODE_ENV=production`
   - `heroku config:set CORS_ORIGIN=http://sfpl.mysalesforcedemo.com`
   - `heroku config:set APP_BASE_URL=http://sfpl.mysalesforcedemo.com`
   - `heroku config:set SESSION_SECRET=<long-random-secret>`
   - `heroku config:set COOKIE_SECURE=true`
   - `heroku config:set SESSION_SAME_SITE=lax`
   - `heroku config:set GOOGLE_CLIENT_ID=<id>`
   - `heroku config:set GOOGLE_CLIENT_SECRET=<secret>`
   - `heroku config:set GOOGLE_CALLBACK_URL=http://sfpl.mysalesforcedemo.com/api/auth/google/callback`
   - `heroku config:set VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX`
   - `heroku config:set GOOGLE_ALLOWED_DOMAIN=salesforce.com`
3. Deploy:
   - `git push heroku main`

## Heroku process model

`Procfile` is configured as:

- `release: npm --prefix server run prisma:deploy` (runs migrations on each deploy)
- `web: npm --prefix server run start` (starts the Express server)

## Build behavior

The backend has `heroku-postbuild` script to build frontend assets and copy them to `server/public`:

- `npm --prefix ../client run build`
- copy `client/dist` into `server/public`

## Smoke checks after deploy

- `GET /api/health` returns `{ ok: true }`
- Open app URL and click "Continue with Google"
- Successful sign-in returns authenticated user via `/api/auth/me`

## Features

### Authentication
- Google OAuth 2.0 SSO
- Domain-restricted access (configurable via `GOOGLE_ALLOWED_DOMAIN`)
- Session-based authentication with PostgreSQL session store
- Team-scoped authorization

### Prompts
- Create, read, update, archive prompts
- Version history with restore capability
- Tag organization
- Collection grouping
- Search and filtering (by text, tag, status, collection)
- Sort by recent, top-rated, most-used
- Variables support for dynamic prompts
- One-click launch to ChatGPT/Claude/Gemini
- Copy to clipboard

### Engagement
- Favorites
- Star ratings (1-5)
- Usage tracking (view/copy/launch events)

### Analytics
- Top used prompts
- Stale prompt detection
- Team activity overview

### Collections
- Organize prompts into collections
- Custom sort order
- Add/remove prompts from collections

## API Endpoints

### Auth
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `POST /api/auth/logout` - End session
- `GET /api/auth/me` - Get current user

### Prompts
- `GET /api/prompts` - List prompts with filters
- `POST /api/prompts` - Create prompt
- `GET /api/prompts/:id` - Get prompt detail
- `PATCH /api/prompts/:id` - Update prompt
- `DELETE /api/prompts/:id` - Archive prompt
- `GET /api/prompts/:id/versions` - List versions
- `POST /api/prompts/:id/restore/:version` - Restore version
- `POST /api/prompts/:id/favorite` - Toggle favorite
- `POST /api/prompts/:id/rating` - Rate prompt
- `POST /api/prompts/:id/usage` - Log usage event

### Tags
- `GET /api/tags` - List tags
- `POST /api/tags` - Create tag

### Collections
- `GET /api/collections` - List collections
- `POST /api/collections` - Create collection
- `PATCH /api/collections/:id` - Update collection
- `POST /api/collections/:id/prompts/:promptId` - Add prompt
- `DELETE /api/collections/:id/prompts/:promptId` - Remove prompt

### Analytics
- `GET /api/analytics/overview` - Get analytics overview

## Tech Stack

### Frontend
- React 19
- TypeScript 5.9+
- Vite 8
- TanStack Query v5
- React Router DOM v7
- Axios
- Tailwind CSS v4
- Google Analytics 4

### Backend
- Node.js 20+
- Express 5
- TypeScript 5.9+
- Prisma 6
- PostgreSQL
- Express Session
- Google OAuth (jose for JWT verification)
- Connection pooling (pg)
