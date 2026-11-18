# LevelUp

LevelUp is a private fitness and nutrition app for two people. It brings daily health tracking and shared goals into one place, so partners can build consistent habits together.

## What it does

- Track meals, calories, macros, workouts, water, weight, and progress photos.
- Set daily check-ins, quests, streaks, and experience points to support steady routines.
- Pair with a partner to progress through a shared map and grow a shared garden.
- Use the installable web app, offline meal queue, step syncing, and push reminders to keep tracking available across the day.

## Stack

- React, TypeScript, and Vite
- Supabase Auth, Postgres, Storage, and Edge Functions
- TanStack Query for server state and Zustand for client state
- Tailwind CSS and a service worker-backed PWA

## Run locally

Requirements: Node.js and npm. A Supabase project is needed for authentication and app data.

```sh
npm install
cp .env.example .env
```

Set the Supabase project URL and public anon key in `.env`:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_VAPID_PUBLIC_KEY=your-vapid-public-key
```

The VAPID key is used for web push. Leave it unset if push notifications are not configured.

Start the development server:

```sh
npm run dev
```

Build the production bundle with `npm run build`. Run the code linter with `npm run lint`.

## Supabase

Database schema changes are in `supabase/migrations/`; server-side endpoints are in `supabase/functions/`.

```sh
supabase link --project-ref <project-ref>
supabase db push
```

Deploy Edge Functions with the Supabase CLI after configuring the secrets required by the functions you use. Keep service role keys and third-party secrets in Supabase secrets, never in the client `.env` file.
