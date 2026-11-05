# WavyPDF – PDF to Audio

Upload a PDF, review the extracted text and chapter breaks, then generate a narrated
audiobook (MP3 or WAV) with Gemini text-to-speech. Signed-in users can save audiobooks to a
personal library.

## Setup

**Prerequisites:** Node.js 20+, a [Gemini API key](https://aistudio.google.com/apikey), and a
[Supabase](https://supabase.com) project.

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local` and fill it in.
3. In the Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql). It creates the
   `playlists` table, the private `audio-playlists` bucket and the row-level-security policies.
4. Start the app: `npm run dev` (http://localhost:3000)

## Scripts

| Command           | What it does                                   |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Express + Vite dev server                      |
| `npm run build`   | Build the client and bundle the server to `dist/` |
| `npm start`       | Run the production build                       |
| `npm run lint`    | Type-check (strict)                            |
| `npm test`        | Unit tests (vitest)                            |
| `npm run check`   | Type-check and test                            |

## How it works

```
Browser ──(Supabase session token)──▶ Express /api/* ──(GEMINI_API_KEY)──▶ Gemini
```

- The **Gemini key lives only on the server.** The browser calls `/api/extract`, `/api/cleanup`,
  `/api/tts` and `/api/preview`; every route requires a valid Supabase session, is rate limited per
  user, and validates its input (`server/`). Never add the key to a `VITE_` variable or to
  `vite.config.ts`'s `define` — anything there is readable by every visitor.
- Text extraction tries Gemini first and falls back to local pdf.js extraction plus an AI cleanup.
- Audio is generated per segment, so a failed run resumes from the segments that already succeeded.
- Saved audio is stored in a private bucket and played through short-lived signed URLs.

## Layout

- `server/`, `server.ts` – API, auth, rate limiting, Gemini wrapper
- `shared/` – constants shared by server and client
- `src/lib/` – pure logic (chunking, chapters, audio encoding, API client)
- `src/hooks/` – conversion workflow, settings, cloud save
- `src/components/` – UI
