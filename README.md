# LevelUp

A private, two-person fitness & health PWA. See `BUILD_PLAN.md` (in the parent folder) for the
full spec.

## Local development

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Database

Schema, RLS policies and storage buckets live in `supabase/migrations/`. Push with:

```bash
supabase link --project-ref <project-ref>
supabase db push
```
