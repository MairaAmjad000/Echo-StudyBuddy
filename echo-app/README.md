# Echo

A study app. Upload slides, PDFs, Word files or text, and Echo builds notes, flashcards and quizzes from them, then listens while you explain a topic and marks what you missed.

## Run it

```
npm install
npm run dev        # development, http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build
```

Needs Node 18 or newer.

## What works

| Page | Route | What it does |
|---|---|---|
| Landing | `/` | Marketing page with live flashcard and quiz demos |
| Sign up / Log in | `/signup`, `/login` | Local account (name only, stored in this browser) |
| Dashboard | `/app` | Streak, XP, today's mission, recent activity |
| Learning Map | `/app/map` | Topics of a course in order; finish one to open the next; last stop is the boss round |
| Upload Material | `/app/materials` | Drag and drop PDF, PPTX, DOCX, TXT, MD, or save a YouTube link |
| Smart Notes | `/app/notes` | Generated notes with contents list; export; jump to cards or quiz |
| Flashcards | `/app/flashcards` | Flip, mark easy or hard (keys E and H); hard cards come back |
| Quiz Arena | `/app/quiz` | Fight a monster: right answers hurt it, wrong ones hurt Echo |
| Teach Echo | `/app/teach` | Speak or type an explanation; Echo marks what you covered and missed |
| Performance | `/app/performance` | XP chart and five attribute bars from your real activity |
| Achievements | `/app/achievements` | Nine goals with progress |
| Settings | `/app/settings` | Rename, reduce motion, export data, load sample progress, reset |

## How it works

- **No server.** Everything is stored in `localStorage` under the key `echo.v1`. Files are read in the browser and never uploaded.
- **Study packs are made by a rule-based generator**, not a language model. `src/lib/generate.js` finds headings, definitions ("X is ...", "X: ...") and key sentences, then builds notes, cards and questions from them. Files with clear headings and definitions give the best results. To use a language model instead, replace the body of `generateStudyPack` and keep the same return shape: `{ sections, cards, questions }`.
- **Teach Echo scoring** (`src/lib/score.js`) checks which key points of the topic appear in your explanation. It matches words, not meaning, so a correct answer in unusual words can be marked as missed.
- **Voice** uses the browser's Web Speech API (Chrome, Edge, Safari). Where it is missing, typing works the same way.
- **YouTube links** are saved, but the video's transcript can't be fetched from the browser. Paste the transcript and Echo builds notes from it.
- **Old `.ppt` and `.doc` files** can't be read. Save them as `.pptx` or `.docx` first.
- **Scanned PDFs** are pictures, so they contain no text to read.

## Code layout

```
src/
  main.jsx, App.jsx        routes and the signed-in guard
  store/                   AppContext (state + actions), seed (built-in sample course)
  lib/                     extract, generate, score, stats, achievements, xp, format
  hooks/                   useBattle, useDeck, useSpeech, useMaterialSelection, useDocumentTitle
  components/
    brand/                 EchoMark, EchoFull, Fiend, Logo
    ui/                    Button, EmptyState, EchoNote, PageHeader, ProgressBar, ScoreRing, SelectField, ToastHost, ErrorBoundary
    layout/                AppShell, Sidebar, MarketingHeader, SiteFooter
    landing/               Hero, MarkedSheet, FeaturesSection, FeatureDemos, UploadFormats, ClosingCta
    dashboard/             StatStrip, MissionCard, ActivityList
    map/                   CourseMap
    upload/                DropZone, LinkForm, MaterialList
    notes/                 NoteToc, NoteSection
    flashcards/            FlashDeck
    quiz/                  BattleView
    teach/                 Recorder, Waveform, FeedbackPanel
    performance/           LineChart, AttributeBars
  pages/                   one file per route
  styles/                  tokens.css (colours, type, spacing), base.css, pages.css
```

Change colours, fonts and spacing in `src/styles/tokens.css`. Change how much XP each action earns in `src/lib/xp.js`.
