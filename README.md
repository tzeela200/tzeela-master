# צאלה — Personal Agent Dashboard

Private, single-user Web/PWA dashboard of dedicated AI agents. Hebrew, full RTL, mobile first, Heebo.
Quick entry → pick an agent → work in an isolated thread → save an output only when it matters.

Live: https://tzeela-master.vercel.app

## Stack
Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Auth, Postgres, Storage) · Vercel ·
Anthropic (text) · OpenAI (images)

## Setup
```bash
npm install
cp .env.example .env.local   # fill in values (see below)
npm run dev                  # http://localhost:3000
```

## Environment
Names only — never commit real values (`.env*` is git-ignored except `.env.example`).

| Name | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Supabase anon key (public, protected by RLS) |
| `AI_API_KEY` | **server only** | Anthropic key — text agents, thread titles, output summaries, Master Agent |
| `IMAGE_API_KEY` | **server only** | OpenAI key — image agents |
| `AI_TEXT_MODEL`, `AI_FAST_MODEL`, `AI_IMAGE_MODEL` | server only, optional | Model overrides (defaults in `lib/ai/models.ts`) |
| `NEXT_PUBLIC_SITE_URL` | optional | Absolute base for link-preview URLs (defaults to the Vercel URL) |

`SUPABASE_SERVICE_ROLE_KEY` is **not used**: every server action runs with the signed-in user's session under RLS.

## Supabase
Run the files in `supabase/migrations/` in order in **Supabase → SQL Editor**.
`0001_init.sql` creates:
- Tables `agents`, `sessions`, `agent_outputs` with CHECK constraints (validation), indexes, and `ON DELETE CASCADE` from agents.
- RLS on all three tables: only the authenticated owner (`public.is_owner()`) can read/write. `anon` has no access.
- Private storage buckets `uploads` (attachments, generated images) and `outputs` (saved outputs), 20MB per file, same owner policy.

## Authentication
Single user, email + password.
1. Supabase → Authentication → Users → create the user (Auto Confirm).
2. Supabase → Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".
3. The owner email is set in `public.is_owner()` (migration 0001). Change it there if the login email changes.

`middleware.ts` protects every route except `/login`; API routes return 401 without a session.

## AI routing
The UI never shows models or providers — routing is server-side, by agent type (`app/api/chat/route.ts`):

| Agent | Route | Output |
|---|---|---|
| `is_image_generator = false` | Anthropic Messages API, streamed | Text, streamed as NDJSON to the workspace |
| `is_image_generator = true` | OpenAI Images | PNG stored in private storage, shown via signed URL |
| `is_master = true` | Text route + summaries of saved outputs in the agent's category | Text |

**Thread isolation:** a request contains the agent's system prompt + the current thread's messages (and that thread's attachments) only. The server verifies that the session belongs to the agent. Master Agents read `summary_text` of saved outputs only — never sessions.

Other server routes: `/api/extract` (PDF/DOCX/XLSX text extraction), `/api/outputs` (save output: AI summary + file in `outputs`).

## Files
One file per message, up to 20MB: PDF, DOCX, TXT, CSV, XLSX, PNG, JPG/JPEG.
- TXT / CSV are read in the browser — the raw file is never uploaded.
- PDF / DOCX / XLSX are uploaded to private storage and extracted on the server (PDFs without a text layer are sent to the model as documents).
- Images are downscaled in the browser, then uploaded.

## Voice
Web Speech API with `lang = "he-IL"`. Speech becomes editable text in the composer; no audio is stored.

## PWA
`app/manifest.ts`, icons in `public/icons` (from the MYUP logo), `public/sw.js` (navigation fallback to `public/offline.html` only — not offline-first; no private data is cached). The service worker registers in production builds only.

## Development
```bash
npm run dev          # dev server
npm run lint         # ESLint
npx tsc --noEmit     # type check
```
To run a verification build next to a running dev server without clobbering `.next`:
```bash
NEXT_DIST_DIR=.next-verify npm run build
```

## Production
```bash
npm run build
npm start
```

## Deployment
Vercel project `tzeela-master`, connected to `tzeela200/tzeela-master`; every push to `main` deploys to production.
Set the environment variables above in Vercel → Settings → Environment Variables (Production + Preview), then redeploy.
Link previews use `app/opengraph-image.jpg`; the site is `noindex`.

## Architecture
```
app/
  login/                     sign-in
  (app)/                     authenticated area: Sidebar (desktop) / bottom nav (mobile)
    page.tsx                 Dashboard (search, favorites, all agents, recent work, quick actions)
    agents/new, [id]/edit    agent form (create / edit / delete with cascade)
    agents/[id]              Workspace (threads, conversation, composer, files, voice)
    outputs/                 archive (search, filters, status, open/copy/download/share/delete)
    settings/                account + sign out
  api/chat | extract | outputs
components/                  UI (AgentCard, AgentForm, workspace/*, outputs/*, ConfirmDialog, Toast…)
lib/                         supabase clients, ai/*, types, files, sessions
supabase/migrations/         SQL
```
State: React state and small hooks only. Design tokens are CSS variables in `app/globals.css` (brand pink `#CC0C6C` from the MYUP logo), so Dark Mode can be added later without touching components.

## Known limitations (MVP)
- One attachment per message; extracted text above 500,000 characters is rejected (not truncated).
- Attachment files are not removed from storage when an agent is deleted (output files are).
- Master Agent matches outputs by exact category name (case-insensitive, trimmed); it reads up to the 200 most recent summaries.
- Voice input depends on browser support for the Web Speech API (e.g. Chrome, Safari); unsupported browsers show a message and typing still works.
- No Dark Mode (tokens are ready for it).
