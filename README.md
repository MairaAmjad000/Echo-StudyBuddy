<div align="center">

<img src="echo-app/public/echo.png" alt="Echo, the study companion" width="150" />

# Echo

**Upload your slides. Echo writes the notes, builds the flashcards, quizzes you on it — then listens while you explain it back and marks what you missed.**

![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![Vite 8](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Node 22](https://img.shields.io/badge/Node-22-339933?logo=nodedotjs&logoColor=white)
![Express 4](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208-47A248?logo=mongodb&logoColor=white)
![Gemini](https://img.shields.io/badge/AI-Gemini-4285F4?logo=googlegemini&logoColor=white)
![Deployed on Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)

<!-- TODO(live-demo): put the deployed frontend URL here once it is public.
     API: https://echo-app-orpin.vercel.app/api/health -->

</div>

---

## The idea

Most study tools stop at "here are your notes". Echo keeps going.

You drop in a lecture PDF, a slide deck, a Word file, a plain-text export or a YouTube link. Echo reads it and produces a **study pack** — revision notes with a contents list, flashcards, and multiple-choice questions — all built from your own material, never from a topic it guessed. From that one upload you get five ways to work: read the notes, drill the cards, fight the quiz, walk the course map, or talk it through with Echo. Two more modes go further: **Podcast with Echo** turns the material into a two-host episode you can listen to, and the **Whiteboard Teacher** solves a typed or photographed question on a board, one narrated step at a time.

**Teach Echo** is the point of the whole thing. It listens while you explain a topic out loud, checks your explanation against the key points of that section, and tells you exactly which ones you skipped. If you cannot say it out loud, you do not know it yet — and now something is keeping score.

Everything is tied into a single progress record: XP per action, levels, streaks, five performance attributes and nine achievements. Every number is computed on the server from your real activity, so the levels mean something.

Echo is the companion that lives on every page: a small avatar that reads the route you are on and what you just did, and reacts — cheering when a topic is finished, thinking while a pack is generated, sympathetic when a quiz goes badly. Sixteen poses, one for each mood the app can put it in.

## What it does

| Page | Route | What it does |
| --- | --- | --- |
| Landing | `/` | The pitch, plus live flashcard and quiz demos you can actually play |
| Sign up / Log in | `/signup`, `/login` | Email + password, or Google. The session is an httpOnly cookie — no token in JavaScript |
| Dashboard | `/app` | Today's mission, streak, XP, notes and quizzes this week, recent activity |
| Learning Map | `/app/map` | Your course as a winding trail of topics; finish one to open the next, last stop is the boss round |
| My Materials | `/app/materials` | Drag and drop PDF, PPTX, DOCX, TXT or MD, save a YouTube link, or paste a transcript |
| Smart Notes | `/app/notes` | The generated notes with a contents list, printable and set up for revision |
| Flashcards | `/app/flashcards` | Flip, then mark easy or hard (keys `E` and `H`); hard cards come back around |
| Quiz Arena | `/app/quiz` | A fight: every right answer hurts the monster, every wrong one lets it hit Echo |
| Teach Echo | `/app/teach` | Speak or type your explanation; Echo marks the key points you covered and the ones you missed |
| Chat with Echo | `/app/chat` | Ask questions about one of your materials, grounded in its own text, with saved conversations |
| Podcast | `/app/podcast` | Turn a material into a two-host episode, written by AI and read by free Edge voices |
| Whiteboard Teacher | `/app/whiteboard` | Type or photograph a question; Echo writes the solution on a whiteboard step by step and reads it aloud |
| Performance | `/app/performance` | XP chart over a week, month or all time, plus five attribute bars from your real activity |
| Achievements | `/app/achievements` | Nine goals with live progress |
| Settings | `/app/settings` | Display name, profile picture, hide Echo, reset progress, delete the account |

## How the AI is wired

- **Study packs** are built by Gemini for the chunks that come back well, and the whole material is read: text is cut on paragraph or sentence boundaries into 24,000-character chunks (up to 10), two requests run at a time to stay inside the free tier, rate limits and 5xx answers are retried with a 2s then 8s backoff, and the per-chunk packs are merged. The caps (60 sections, 400 cards, 300 questions) are spread across chunks rather than truncating the tail, so a long PDF never loses its last chapters.
- **Nothing depends on a paid key.** With `AI_API_KEY` empty — or when the provider fails — `server/src/lib/generate.js` takes over: a rule-based generator that finds headings, definitions and key sentences and builds the same `{ sections, cards, questions }` shape. The app is fully usable with no AI account at all.
- **Chat with Echo** answers from the material's own text (up to 200,000 characters of it, kept out of every list response), falling back to the generated pack when no original text was saved. Replies and stored conversations are marked `private, no-store`, and the route is limited to 20 questions a minute per account.
- **Whiteboard Teacher** asks Gemini for a small, strictly shaped lesson — 3 to 7 steps, each with short board lines and a spoken explanation — and saves it, so reopening a lesson from the history rail costs no AI call. A photo of a question is sent to Gemini as inline image data (the browser compresses it first), so the feature needs no OCR service. The board is typeset with KaTeX (MIT, bundled), and each step is read in the podcast's voice.
- **Podcast and whiteboard narration** use Microsoft Edge's free neural voices through `msedge-tts`: no key, no per-character bill. Audio is recorded one turn or step at a time, cached by the browser for a week, and validated with an ETag, so a re-listen makes no request. The podcast's default Studio preset and the teacher share the same Echo voice (`en-US-AvaNeural`) from one constant in `server/src/lib/tts.js`.
- **Teach Echo** is graded by the model when a key is present (does the explanation cover the key point *in substance*, not by keyword) and by `echo-app/src/lib/score.js` when it is not.
- **Failure is explained, not hidden.** An exhausted quota answers 429 — "Echo has used up its AI quota for now" — a slow provider answers 504, and chat with no key answers 503 with the exact variable to set.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, React Router 7, Vite 8 |
| File parsing | `pdfjs-dist` (PDF), `mammoth` (DOCX), `jszip` (PPTX) — all in the browser |
| Voice | Microsoft Edge neural voices via `msedge-tts` (podcast + whiteboard, free), Web Speech API recognition for Teach Echo, typing as the fallback |
| Backend | Node 22, Express 4, Mongoose 8, zod validation |
| Database | MongoDB |
| Auth | JWT in an httpOnly cookie, bcrypt password hashing, Google OAuth 2.0 (authorization code + signed state cookie) |
| AI | Gemini (Google AI Studio) with a rule-based fallback generator |
| Hardening | Helmet, CORS pinned to `CLIENT_ORIGIN`, rate limits on auth and chat, per-user query scoping |
| Hosting | Vercel (frontend and API as separate projects) |
| Styling | Hand-written CSS with design tokens, a dark theme, a print stylesheet and no UI framework |

## Architecture

```
                    ┌──────────────────────────── browser ────────────────────────────┐
                    │  React + Vite                                                   │
                    │  · parses PDF / DOCX / PPTX / TXT locally — files never leave   │
                    │  · speech recognition for Teach Echo, speech synthesis for Echo │
                    └───────────────┬─────────────────────────────────────────────────┘
                                    │  fetch('/api/...', credentials: 'include')
                                    │  (session in an httpOnly cookie, never localStorage)
                                    ▼
                    ┌───────────────────────────── Express ───────────────────────────┐
                    │  /api/auth        signup, login, logout, me, Google OAuth       │
                    │  /api/materials   uploads, links, transcripts, study packs      │
                    │  /api/progress    XP, streaks, quiz/card/teach results, summary │
                    │  /api/chat        grounded questions + saved conversations      │
                    │  /api/podcasts    two-host episodes + one turn of audio at once │
                    │  /api/whiteboard  typed or photo lessons + one step of audio    │
                    │  middleware: requireAuth · validate(zod) · rate limit · helmet  │
                    └───────┬─────────────────────────────────────────┬───────────────┘
                            │                                         │
                            ▼                                         ▼
                  ┌──────────────────┐                    ┌────────────────────────┐
                  │     MongoDB      │                    │  Gemini  (optional)    │
                  │  users           │                    │  study packs, chat,    │
                  │  progress        │                    │  grading, podcast +    │
                  │  materials       │                    │  whiteboard lessons    │
                  │  chatsessions    │                    └────────────────────────┘
                  │  podcasts        │                      no key → rule-based
                  │  whiteboard      │                      packs still generate
                  └──────────────────┘
```

Podcast turns and whiteboard steps are recorded on demand by Microsoft Edge's free neural voices (`msedge-tts`) and returned as MP3; no audio is stored on the server. In development Vite proxies `/api` to the Express server on `:4000`. In production the frontend's `/api` rewrite forwards to the deployed API, so the browser only ever sees one origin and the session cookie stays first-party.

## Repository layout

```
echo-app/                  the React front end
  src/pages/               one file per route
  src/components/          ui, layout, landing, dashboard, upload, notes, flashcards,
                           quiz, teach, chat, podcast, whiteboard, performance, map,
                           mascot, brand
  src/hooks/               useSpeech, useNarration, useEpisodePlayer, useBattle, useDeck
  src/lib/                 extract, generate, image, score, stats, achievements, xp, api
  src/store/               AppContext — the single source of client state
  src/styles/              tokens, base, pages, dark, print
  public/                  Echo's and Milo's artwork, avatars and favicon

server/                    the Express + MongoDB API
  src/routes/              auth, materials, progress, chat, podcasts, whiteboard
  src/controllers/         one module per route group
  src/models/              User, Progress, Material, ChatSession, Podcast,
                           WhiteboardLesson
  src/lib/                 ai, chat, generate, podcast, whiteboard, tts, stats, xp,
                           google, jwt, avatars
  src/services/            progress.service — XP, achievements, summaries
  api/index.js             the single Vercel function every /api route lands on
```

Two focused READMEs go deeper: [echo-app/README.md](echo-app/README.md) for the front end and [server/README.md](server/README.md) for the API, including the Google sign-in walkthrough.

## Getting started

You need **Node 22.12 or newer** (both packages pin it: the API is `22.x`, the app asks for `>=22.12`) and a **MongoDB** database — a local server or a free Atlas cluster both work.

### 1. API

```bash
cd server
cp .env.example .env          # set MONGODB_URI and JWT_SECRET (16+ characters)
npm install
npm run dev                   # node --watch, http://localhost:4000
```

Check it: `curl http://localhost:4000/api/health` → `{"ok":true,"env":"development"}`.

### 2. App

```bash
cd echo-app
npm install
npm run dev                   # http://localhost:5173
```

Open `http://localhost:5173`, sign up, and drop a PDF or a slide deck in — with no AI key configured the rule-based generator builds the pack immediately. If you want every page populated on the spot, `POST /api/progress/demo` with your session fills in a believable two weeks of study (about 2,500 XP, level 5); nothing in the UI calls it yet.

Adding `AI_API_KEY` (a Google AI Studio key) to `server/.env` upgrades study packs, chat, podcasts and Teach Echo grading to Gemini. The Whiteboard Teacher needs that key to work at all. Nothing else changes.

## Environment variables

**`server/.env`** — validated at boot with zod; the server refuses to start on bad config.

| Variable | Required | Default | Purpose |
| --- | --- | :---: | --- |
| `MONGODB_URI` | ✅ | — | MongoDB connection string |
| `JWT_SECRET` | ✅ | — | Signs session tokens (16+ characters) |
| `NODE_ENV` | | `development` | `production` turns on `SameSite=None; Secure` cookies and hides internals |
| `PORT` | | `4000` | Local API port; not used on Vercel |
| `JWT_EXPIRES` | | `7d` | Session lifetime |
| `CLIENT_ORIGIN` | | `http://localhost:5173` | The only origin allowed by CORS, and the default Google redirect base |
| `BCRYPT_ROUNDS` | | `12` | Password hashing cost |
| `AI_API_KEY` | | *(empty)* | Google AI Studio key. Empty → rule-based packs and podcasts, no chat, no whiteboard |
| `AI_MODEL` | | `gemini-2.5-flash` | Model for packs, chat, podcasts, lessons and grading |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | | *(empty)* | Enables "Continue with Google" when both are set |
| `GOOGLE_REDIRECT_URI` | | `<CLIENT_ORIGIN>/api/auth/google/callback` | Must match the OAuth client exactly |

**`echo-app/.env`** — everything is optional.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | *(empty = same origin)* | Base URL for API calls. Leave it empty: the deployed frontend proxies `/api` to the API, and a cross-site base URL makes browsers drop the session cookie |

## API reference

Everything under `/api` except `health` and the Google routes needs a session (cookie or `Authorization: Bearer <token>`).

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness and environment |
| `GET` | `/api/auth/providers` | Which sign-in methods are configured, e.g. `{ google: true }` |
| `GET` | `/api/auth/google` | `?next=/app` — begin Google sign-in (redirect) |
| `GET` | `/api/auth/google/callback` | Google's return leg; opens the session (redirect) |
| `POST` | `/api/auth/signup` | `{ name, email, password }` |
| `POST` | `/api/auth/login` | `{ email, password }` |
| `POST` | `/api/auth/logout` | Clear the session cookie |
| `GET` `PATCH` | `/api/auth/me` | Current user and progress; rename, or set a profile picture the level has unlocked |
| `DELETE` | `/api/auth/account` | Delete the account and everything it owns |
| `GET` `POST` | `/api/materials` | List, or create from a pack, text or sections |
| `POST` | `/api/materials/link` | Save a YouTube link; a 200+ character transcript builds notes at once |
| `GET` `PATCH` `DELETE` | `/api/materials/:id` | One material; attach a transcript; delete |
| `GET` | `/api/progress` | The full progress document |
| `GET` | `/api/progress/summary` | Streak, level, weekly counts, mission, attributes, XP buckets |
| `POST` | `/api/progress/quiz` | Record a quiz result — XP is awarded server-side |
| `POST` | `/api/progress/cards` | Record flashcard marks |
| `POST` | `/api/progress/teach` | Record a Teach Echo score |
| `PATCH` | `/api/progress/sections/:materialId` | Toggle a topic done (XP once per topic) |
| `POST` | `/api/progress/last-studied` | Remember the current topic |
| `PATCH` | `/api/progress/settings` | Preferences such as `{ "reduceMotion": true }` |
| `POST` | `/api/progress/demo` | Load believable sample progress |
| `POST` | `/api/progress/reset` | Wipe progress, keeping materials |
| `DELETE` | `/api/progress` | The same reset, for clients that prefer DELETE |
| `GET` | `/api/chat/sessions` | Past conversations, newest first |
| `GET` `DELETE` | `/api/chat/sessions/:id` | One conversation, or forget it |
| `POST` | `/api/chat` | `{ materialId, messages, sessionId? }` → `{ reply, sessionId, model }` |
| `GET` `POST` | `/api/podcasts` | List episodes, or write one from a material |
| `GET` `DELETE` | `/api/podcasts/:id` | One episode with its script, or delete it |
| `GET` | `/api/podcasts/:id/audio/:index` | Record and return one turn as MP3 (ETag + immutable cache) |
| `PATCH` | `/api/podcasts/:id` | Save the turn the student stopped at |
| `GET` `POST` | `/api/whiteboard` | List saved lessons, or teach a typed/photographed question |
| `GET` `DELETE` | `/api/whiteboard/:id` | One lesson with every step, or delete it |
| `GET` | `/api/whiteboard/:id/audio/:index` | Record and return one step in the podcast's voice |

## Data model

| Model | Holds |
| --- | --- |
| `User` | Name, lowercase-unique email, bcrypt hash, Google subject id, avatar id, preferences |
| `Progress` | `xp`, `xpLog`, `studyDays`, `sectionsDone`, `cardsEasy`, `quizLog`, `teachLog`, `activity`, `lastStudied`, `settings` |
| `Material` | Title, type, status (`ready` / `needs-text`), source URL, the study pack, and the original `sourceText` (selected only when chat needs it) |
| `ChatSession` | One conversation: title, the material it is about, up to 200 stored messages |
| `Podcast` | An episode script: title, voice preset, turns with the voice for each, estimated duration, saved position |
| `WhiteboardLesson` | A saved lesson: title, subject, question, typed/photographed source, steps with board lines and narration, final answer |

## Things worth knowing

- **Files are parsed on your device.** PDF, DOCX, PPTX and text are read in the browser; only the resulting text or sections are sent to the API. The front end never uploads the file itself.
- **Sessions live in an httpOnly cookie.** No token in `localStorage`, so an XSS bug cannot read a session. In production the cookie is `SameSite=None; Secure` because the app and the API are separate origins; in development it is `Lax`.
- **Every query is scoped to its owner.** Materials, progress, chat sessions, episodes and lessons are always filtered by `owner: req.user._id`, so nothing leaks between accounts — including the audio routes, where one account cannot ask for another's lesson or episode by id.
- **Deleting the account really deletes it.** `DELETE /api/auth/account` removes materials, progress, conversations, episodes and lessons for that account, not just the user row.
- **Free, but not serverless-shy.** Recording a podcast turn or a whiteboard step opens a WebSocket to Microsoft's Edge service; the connection is pooled per voice and closed after a few idle minutes, and every call is bounded well inside the host's function limit so a stalled socket becomes a readable 503 instead of a killed request.
- **XP and achievements are server-authoritative.** The client never reports its own XP — `server/src/services/progress.service.js` awards it, and topic XP is granted once per topic through an `xpAwarded` map. The same server checks profile-picture unlocks against your level, so an edited client cannot take a picture it has not earned.
- **Attributes are earned, not filled in.** Knowledge is quiz accuracy, Memory is cards marked easy, Problem solving is your average Teach Echo score, Consistency is how many of the last seven days you studied, Speed is answers given in under 12 seconds. A value with no data behind it stays empty instead of showing a fake bar.
- **Echo reacts to you.** Every line Echo can say lives in `echo-app/src/components/mascot/scenarios.js`; the page you are on and what you just did decide which one it uses, and the pose that comes with it. On a phone the greeting stacks Echo under his speech bubble and the light/dark switch moves into the top bar.
- **Polish in three places:** a token-driven dark mode (`styles/dark.css`), a print stylesheet so notes come out clean on paper, and a mobile layout verified down to 375px.

### XP and levels

| Action | XP |
| --- | --- |
| Upload a material | 15 |
| Finish a topic | 20 |
| Correct quiz answer | 10 |
| Defeat the monster | 20 |
| Mark a flashcard easy | 5 |
| Mark a flashcard hard | 2 |
| Teach Echo | score ÷ 2 |

A level is 500 XP, the curve runs to level 200, and every level carries the title *Explorer, level n*. The sample progress from `POST /api/progress/demo` lands at level 5.

## Scripts

| Where | Command | Does |
| --- | --- | --- |
| `echo-app` | `npm run dev` | Vite dev server on `:5173`, proxying `/api` to `:4000` |
| `echo-app` | `npm run build` | Production build into `dist/` |
| `echo-app` | `npm run preview` | Serve the production build locally |
| `server` | `npm run dev` | Express with `--watch` on `:4000` |
| `server` | `npm start` | Express without the watcher |
| `server` | `npm run check` | Syntax-check the entry point |

## Known limits and what is next

- Scanned PDFs and old `.ppt` / `.doc` files cannot be read — save them as `.pptx` / `.docx` first, or paste the text.
- A YouTube link needs its transcript pasted in. A browser cannot read a video's captions, so Echo saves the link as a `needs-text` material and builds the pack as soon as at least 200 characters of transcript arrive. Nothing is fetched from YouTube's servers on your behalf.
- The rule-based generator matches words, not meaning, so an unusually-worded but correct explanation can be marked as missed. With an AI key, grading is semantic.
- There is no automated test suite yet: the checks today are `npm run build`, `npm run check`, and manual passes through the app. A Vitest suite over `lib/generate.js`, `lib/score.js`, `lib/stats.js` and the progress service is the obvious next step.
- Chat history can outlive its material: conversations are stored per account and keep the material's title, so a deleted material still leaves readable history behind.
- Podcast and whiteboard narration need an internet connection. Edge's free voices can briefly rate-limit a burst, so the page asks you to press Play again; if the browser blocks autoplay, the first Play is also the gesture that starts the voice.
- **Whiteboard lessons need `AI_API_KEY`** and have no fallback — a lesson is a solved problem, not a summary. Podcasts do fall back: with no key, or when Gemini fails, `buildPodcastFromPack()` assembles an episode from the material's notes, cards and quiz answers. A blurred or badly lit photo is the usual reason a whiteboard question cannot be read.

## Author

Built by **Maira Amjad** — [@MairaAmjad000](https://github.com/MairaAmjad000).
