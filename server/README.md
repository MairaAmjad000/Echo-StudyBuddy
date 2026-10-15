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

## API

All routes except `auth` and `health` need `Authorization: Bearer <token>`.

| Method | Route | Purpose |
| --- | --- | --- |
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
- **Authorization**: every document query filters by `owner: req.user._id`, so
  users can only ever see their own data.
- **XP and achievements** are computed on the server (`services/progress.service.js`),
  never trusted from the client. Topic XP is awarded once via the `xpAwarded` map.
- **Study packs**: the rule-based generator from the frontend is ported to
  `lib/generate.js`. The frontend may still generate locally; both produce the
  same `{ sections, cards, questions }` shape. Swap the generator body for an
  LLM call without touching anything else.
- **AI**: with `AI_API_KEY` set, `lib/ai.js` builds study packs with Gemini and
  `lib/chat.js` answers Chat with Echo questions. Chat keeps the material's
  original text (`sourceText`, excluded from list responses) as the model's
  reference and falls back to the generated notes; without a key the chat route
  returns 503 and packs fall back to the rule-based generator.
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
