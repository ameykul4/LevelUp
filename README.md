# LevelUp

LevelUp is a private fitness and nutrition app designed for two people. It combines personal health logs with shared goals, helping partners build consistent habits and follow their progress together.

## Problem it solves

Fitness tracking is often split across separate tools for food, exercise, hydration, and progress. LevelUp brings those daily records together and adds a shared partner experience, so tracking and encouragement happen in the same app.

## Features

### Personal tracking

- Log meals, workouts, water, weight, and progress photos.
- Track daily calories and macronutrients against profile targets.
- Use meal photo or voice analysis to estimate nutrition, or scan a product barcode for nutrition data.
- Review check-ins, quests, streaks, experience points, and progress reports.

### Partner features

- Pair two accounts and view shared progress.
- Advance together on a campaign map and tend a shared garden.
- Send a partner a “cover for me” request when they need help keeping a streak.

### Mobile and reminders

- Install the responsive web app as a PWA.
- Queue meal photo and voice entries locally when offline, then sync them when connectivity returns.
- Sync step counts and log water using the included iOS Shortcuts/Scriptable integration.
- Receive scheduled push reminders for water and progress photos when notifications are configured.

## Technology

- **Frontend:** React 19, TypeScript, Vite, React Router
- **UI:** Tailwind CSS, Framer Motion, Recharts
- **Client data:** TanStack Query and Zustand
- **Backend:** Supabase Auth, Postgres, Row Level Security, Storage, and Edge Functions
- **PWA:** Vite PWA plugin, Workbox service worker, and Web Push
- **External data:** Open Food Facts barcode lookup; Gemini-backed meal analysis through a Supabase Edge Function

## Repository layout

```text
src/
  components/       Shared interface components grouped by feature
  hooks/            Reusable React hooks
  lib/              Supabase client, data helpers, and integrations
  pages/            Application routes
  store/            Client-side state
  sw.ts             PWA service worker and push handling
supabase/
  functions/        Server-side Edge Functions
  migrations/       Database schema and policy changes
scriptable/         iOS Scriptable widget integration
public/             PWA icons and static assets
```

## Requirements

- Node.js and npm
- A Supabase project for authentication and application data
- Supabase CLI for applying migrations or deploying Edge Functions

## Local development

Install dependencies and create a local environment file:

```sh
npm install
cp .env.example .env
```

Set the client-side Supabase values in `.env`:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

`VITE_VAPID_PUBLIC_KEY` is used when a user subscribes to push notifications. Push requires the matching VAPID private key and subject to be configured as server-side secrets in Supabase. Meal analysis also requires a `GEMINI_API_KEY` secret for its Edge Function. Do not put private keys, service role keys, or third-party API secrets in `VITE_` variables; Vite includes those values in the client bundle.

Start the development server:

```sh
npm run dev
```

## Supabase setup

Link the project and apply the database migrations:

```sh
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Edge Functions are in `supabase/functions/`. Deploy the functions needed by your setup with the Supabase CLI, for example:

```sh
supabase functions deploy analyze-meal
supabase functions deploy sync-steps
supabase functions deploy log-water
supabase functions deploy widget-data
supabase functions deploy send-push
```

Configure each function’s required secrets in the Supabase project before enabling its integration. In particular, meal analysis uses `GEMINI_API_KEY`; push delivery uses `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `INTERNAL_FUNCTION_SECRET`. The reminder migration also expects the corresponding internal secret to be set as the database setting `app.internal_function_secret` outside the migration.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build the production bundle |
| `npm run preview` | Serve the production bundle locally |
| `npm run lint` | Run Oxlint |

## iOS Shortcuts and Scriptable

The `scriptable/LevelUp.js` file provides a Scriptable widget integration. The Supabase Edge Functions `sync-steps`, `log-water`, and `widget-data` support step sync, quick water logging, and widget data. Configure the user API token and project URL in the integration as described by the script before use.
