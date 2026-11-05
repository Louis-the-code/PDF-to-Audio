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
- **One step:** drop a PDF and the audio is made automatically (turn on *Review text before creating
  audio* to check the text first).
- **Reading:** large PDFs are split into 8-page batches in the browser and read in parallel, so long
  documents are fast and never cut off. A batch the AI can't read falls back to local pdf.js text.
  The fastest available Gemini model is used, falling back automatically (`GEMINI_EXTRACT_MODEL`).
- **Structure:** chapter headings are marked automatically; documents without chapters are split into
  ~12-minute parts.
- **Voicing:** all segments share one queue in reading order with up to 4 requests at once, slowing
  down automatically when Gemini rate-limits. Each chapter is playable as soon as it's finished, and
  finished chapters are cached, so retries and text edits only re-voice what changed.
- Speed is ultimately bounded by your Gemini quota: on the free tier the TTS model allows only a few
  requests per minute, so long documents need a paid tier to be fast.
- Saved audio is stored in a private bucket and played through short-lived signed URLs.

## Layout

- `server/`, `server.ts` – API, auth, rate limiting, Gemini wrapper
- `shared/` – constants shared by server and client
- `src/lib/` – pure logic (chunking, chapters, audio encoding, API client)
- `src/hooks/` – conversion workflow, settings, cloud save
- `src/components/` – UI
