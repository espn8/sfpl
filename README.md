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
6. Start apps:
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
