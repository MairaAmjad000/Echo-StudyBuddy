# Echo API (MERN backend)

Backend for the Echo study app. Express + MongoDB (Mongoose), JWT auth with
bcrypt password hashing, server-side study-pack generation, and
server-authoritative XP / achievements.

## Quick start

```bash
cd server
cp .env.example .env        # set MONGODB_URI and JWT_SECRET
npm install
npm run dev                 # node --watch, http://localhost:4000
```

Requires MongoDB running locally (or a `MONGODB_URI` in `.env`).

## Deploying to Vercel

Create the project from this repo with **Root Directory `server`** and
**Framework Preset `Other`**. The Express preset looks for an `app.js` entry and
then fails every request with `Invalid export found in module
"/var/task/server/src/app.js". The default export must be a function or server`
— `src/app.js` exports `createApp` and no default. Vercel only ever runs
`api/index.js`; `vercel.json` rewrites the whole `/api` surface there because the
platform's file-system routing matched a single path segment per dynamic file,
which stranded `/api/auth/me`, `/api/materials/:id` and every other nested route
with the platform's own 404.

Set these in **Project Settings -> Environment Variables**, for Production (and
Preview, if previews should work): `NODE_ENV=production`, `MONGODB_URI`,
`JWT_SECRET`, `CLIENT_ORIGIN` (the frontend's `https://` origin), and optionally
`JWT_EXPIRES`, `BCRYPT_ROUNDS`, `AI_API_KEY`, `AI_MODEL`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`. There is no `PORT`: nothing listens on one. Root
Directory, preset and environment variables only apply to deployments created
after the change, so redeploy afterwards, then check
`https://<domain>/api/health` — `{"ok":true,"env":"production"}` is a
correctly wired deployment.

## Google sign-in

Optional, and off until it is configured. Set `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` and the sign-in page grows a "Continue with Google"
button; leave them empty and only the email/password form is shown.

1. Google Cloud Console -> **APIs & Services -> Credentials -> Create
   credentials -> OAuth client ID -> Web application**.
2. Add a redirect URI for each place the app runs, exactly:
   `http://localhost:5173/api/auth/google/callback` for development and
   `https://your-domain/api/auth/google/callback` for production. The `/api`
   path is the backend, reached through the frontend's origin (Vite proxies it
   in dev, the reverse proxy does it in production).
3. Paste the client id and secret into `server/.env`.

How it works, end to end:

- `GET /api/auth/google?next=/app` sets a signed, httpOnly `echo_oauth` cookie
  holding a random state and the return path, then redirects to Google.
- `GET /api/auth/google/callback` reads that cookie back, refuses anything whose
  `state` does not match (so a stranger cannot hand us a code of their own),
  swaps the code for an access token, and reads the profile.
- The account is found by Google's subject id first, then by verified email. An
  existing email/password account signing in with Google is **linked**, not
  duplicated; a brand-new one is created with a fresh progress record.
- The browser gets the same httpOnly `echo_session` cookie as a password login,
  and lands back on `next` — no token ever touches localStorage.
- Anything that goes wrong comes back as `/login?authError=<reason>` instead of
  a JSON error page, because both steps are browser navigations.
- Accounts created this way have no password, so the password form tells that
  person to use the Google button rather than failing cryptically.

## API

All routes except `auth` and `health` need `Authorization: Bearer <token>`.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/auth/providers` | Which sign-in methods are configured, e.g. `{ google: true }` |
| GET | `/api/auth/google` | `?next=/app` — start Google sign-in (redirects) |
| GET | `/api/auth/google/callback` | Google's return leg; opens the session (redirects) |
| POST | `/api/auth/signup` | `{ name, email, password }` -> `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` -> `{ token, user }` |
| GET | `/api/auth/me` | Current user + progress |
| DELETE | `/api/auth/account` | Delete account and all data |
| GET | `/api/materials` | List my materials |
| POST | `/api/materials` | Create from a `pack`, or from `text`/`sections` (generated server-side) |
| POST | `/api/materials/link` | Save a YouTube link; a 200+ char `transcript` builds notes immediately |
| GET | `/api/materials/:id` | One material |
| PATCH | `/api/materials/:id` | Attach a `transcript` to a needs-text material |
| DELETE | `/api/materials/:id` | Delete a material |
| POST | `/api/chat` | Chat with Echo: `{ materialId, messages: [{ role: "user" \| "echo", content }] }` -> `{ reply }` (Gemini, grounded in that material) |
| GET | `/api/progress` | Full progress state |
| GET | `/api/progress/summary` | Streak, level, weekly counts, mission, attributes, XP buckets |
| POST | `/api/progress/quiz` | Record a quiz result (XP awarded server-side) |
| POST | `/api/progress/cards` | Record flashcard marks |
| POST | `/api/progress/teach` | Record a Teach Echo score |
| PATCH | `/api/progress/sections/:materialId` | Toggle a topic done (XP once per topic) |
| POST | `/api/progress/last-studied` | Remember the current topic |
| PATCH | `/api/progress/settings` | e.g. `{ "reduceMotion": true }` |
| POST | `/api/progress/demo` | Load believable sample progress |
| POST | `/api/progress/reset` | Wipe progress (materials stay) |

## Design notes

- **Auth**: bcrypt (cost from `BCRYPT_ROUNDS`), JWT signed with `JWT_SECRET`.
  Emails are stored lowercase and uniquely indexed. Auth routes are rate limited.
  Google sign-in lives in `lib/google.js` (no passport): the authorization-code
  flow, a signed state cookie, and the same session cookie as a password login.
  `googleId` is unique and sparse, and `passwordHash` is null on Google-only
  accounts — the two sign-in routes each refuse the other's kind of account with
  a sentence that says which button to press.
- **Authorization**: every document query filters by `owner: req.user._id`, so
  users can only ever see their own data.
- **XP and achievements** are computed on the server (`services/progress.service.js`),
  never trusted from the client. Topic XP is awarded once via the `xpAwarded` map.
- **Study packs**: the rule-based generator from the frontend is ported to
  `lib/generate.js`. The frontend may still generate locally; both produce the
  same `{ sections, cards, questions }` shape. Swap the generator body for an
  LLM call without touching anything else.
- **AI**: with `AI_API_KEY` set, `lib/ai.js` builds study packs with Gemini and
  `lib/chat.js` answers Chat with Echo questions. Chat quotes the material's
  whole original text (`sourceText`, excluded from list responses) — up to the
  200k characters a material may store — so a question can be about any part of
  it, not just the opening; when no text was kept it falls back to everything in
  the generated pack (notes, flashcards and quiz answers). Without a key the
  chat route returns 503 and packs fall back to the rule-based generator. A 429
  from Gemini is reported as an exhausted quota, not as a failed answer.
- **Chat history** is held by the page, not the database: the client sends the
  conversation back with each question, the server keeps the last 12 turns and
  never stores the transcript. The route is rate limited (20 questions/minute).
- **Validation**: zod schemas in `validation/schemas.js`; bad input returns 400
  with the first issue.
- **Errors**: `AppError` carries a status + safe message; unexpected errors are
  logged server-side and never leak internals in production.

## Wiring the frontend

The frontend's `src/store/AppContext.jsx` currently hydrates from localStorage.
To connect it: replace the `load()`/save effect with API calls — `GET /api/auth/me`
on boot with the stored token, then `POST /api/progress/*` for each action
instead of mutating local state. The response shapes match the frontend's state
fields (`sectionsDone`, `cardsEasy`, `quizLog`, `teachLog`, `xp`, `xpLog`,
`studyDays`, `activity`, `achievements`, `lastStudied`), so hydration is direct.
