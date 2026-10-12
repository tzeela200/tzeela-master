# צאלה — Personal Agent Dashboard

Private, single-user Web/PWA dashboard of dedicated AI agents. Hebrew, RTL, mobile first.

> Work in progress — built phase by phase. Full README (AI routing, architecture, deployment, known limitations) is completed in Phase 8.

## Stack
Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Auth, Postgres, Storage) · Vercel

## Setup
```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

## Environment
| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | public, protected by RLS |
| `AI_API_KEY` | server only | Anthropic — text agents, summaries |
| `IMAGE_API_KEY` | server only | OpenAI — image agents |
| `AI_TEXT_MODEL` / `AI_FAST_MODEL` / `AI_IMAGE_MODEL` | server only | optional overrides, see `lib/ai/models.ts` |

## Supabase
Run `supabase/migrations/*.sql` in order in the Supabase SQL Editor.

## Authentication
Single user, email + password. Create the user in Supabase → Authentication → Users and disable public sign-ups. RLS additionally restricts all data to the owner email defined in `public.is_owner()`.

## Scripts
- `npm run dev` — development
- `npm run build` — production build
- `npm run lint` — lint
- `npx tsc --noEmit` — type check
