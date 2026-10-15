import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import Echo from '/src/strobi-avatar/Strobi.tsx'
import { useCompanion } from './companion-context.jsx'
import {
  streakStory,
  courseStory,
  notesStory,
  cardsStory,
  quizStory,
  teachStory,
  arrivalStory,
  idleStory,
  wakeStory,
  levelStory,
  xpStory,
  achievementStory,
} from './scenarios.js'
import { useApp } from '../../store/AppContext.jsx'
import { readyMaterials, materialProgress } from '../../lib/stats.js'
import './companion.css'

// Pages that never show the floating mascot: auth pages stay clean, the
// dashboard/materials/chat each carry their own Echo, and the corner would
// only compete with them.
const NO_MASCOT_PATHS = ['/login', '/signup', '/app', '/app/materials', '/app/chat']

// Pages where the floating mascot only makes sense once a course exists:
// with nothing loaded there is nothing to help with, so the corner stays free.
const NO_COURSE_PATHS = ['/app/map', '/app/notes', '/app/flashcards', '/app/quiz', '/app/teach']

// Study pages where Echo speaks only about what is on screen. His own
// milestone chatter is held back on these so it never covers the material or
// the numbers the student is reading.
const FOCUS_PATHS = ['/app/map', '/app/notes', '/app/flashcards', '/app/quiz', '/app/teach', '/app/performance']

// The pose each route maps to, so Echo mirrors what the user is doing.
// All names must exist in strobi.avatar.ts's animations.
const ROUTE_MAPS = {
  '/': 'idle',
  '/signup': 'happy',
  '/login': 'playful',
  '/app': 'working',
  '/app/map': 'curious',
  '/app/materials': 'working',
  '/app/notes': 'listening',
  '/app/flashcards': 'thinking',
  '/app/quiz': 'excited',
  '/app/teach': 'listening',
  '/app/chat': 'listening',
  '/app/performance': 'proud',
  '/app/achievements': 'celebrate',
  '/app/settings': 'idle',
}

function mapRoute(route) {
  let best = null
  for (const [path, name] of Object.entries(ROUTE_MAPS)) {
    if (route === path || route.startsWith(path + '/')) {
      if (!best || path.length > best[0].length) best = [path, name]
    }
  }
  return best ? best[1] : 'idle'
}

// When the last visit happened, stamped on the way out. Only a timestamp —
// nothing about the student ever goes in localStorage.
const LAST_VISIT_KEY = 'echo.lastVisit'
const readLastVisit = () => {
  try {
    return Number(localStorage.getItem(LAST_VISIT_KEY)) || null
  } catch {
    return null
  }
}
const stampVisit = () => {
  try {
    localStorage.setItem(LAST_VISIT_KEY, String(Date.now()))
  } catch {
    /* storage full or blocked — the greeting just falls back */
  }
}

// Echo starts a story at most this often; anything sooner waits its turn.
const STORY_GAP_MS = 8000
// Dismissing a note buys this much quiet.
const SILENCE_MS = 60_000

/** The note that floats above Echo while something happens. */
function Speech({ text, tone, onDismiss }) {
  if (!text) return null
  return (
    <div className={`companion-note companion-note-${tone}`} role="status" aria-live="polite">
      {text}
      <button type="button" className="companion-note-dismiss" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}

/** A live avatar that reads the route, the page's reactions and says notes. */
export function Companion({ route }) {
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const { state, streak, level, toasts, booting } = useApp()
  const { speech, notification, pose, dismiss, react } = useCompanion()
  const hasCourse = readyMaterials(state).length > 0
  const defaultPose = mapRoute(route)
  const [animation, setAnimation] = useState('waking')
  const wakeRef = useRef(null)

  // The corner mascot: off on the pages that carry their own Echo, off on the
  // tool pages until a course exists, and off whenever the student has
  // switched him off in Settings.
  const visible =
    state.settings.echoEnabled !== false &&
    !NO_MASCOT_PATHS.includes(pathname) &&
    !(NO_COURSE_PATHS.includes(pathname) && !hasCourse)
  // On the study pages Echo stays on the course in front of you. The generic
  // XP/level/achievement chatter is muted there: it only competes with the map
  // or the notes the student is reading.
  const focused = FOCUS_PATHS.includes(pathname)

  // ---- the story queue -----------------------------------------------------
  // Page reactions (a battle hit, a cleared deck) speak immediately through
  // react(). Echo's own chatter — arrival, milestones, idle — goes through the
  // queue so it never stacks notes on top of each other, and dismissing a note
  // buys a minute of quiet.
  const lastSpokeAt = useRef(0)
  const pendingStory = useRef(null)
  const pendingTimer = useRef(null)
  const silentUntil = useRef(0)

  const queue = useCallback(
    (story) => {
      if (!story || !story.line) return
      const now = Date.now()
      if (now < silentUntil.current) return
      const urgent = story.tone === 'error' || story.tone === 'success'
      const wait = STORY_GAP_MS - (now - lastSpokeAt.current)
      const speak = (s) => {
        lastSpokeAt.current = Date.now()
        react(s.pose, s.line, s.tone || 'info', s.ms || 6000)
      }
      if (urgent || wait <= 0) {
        clearTimeout(pendingTimer.current)
        pendingStory.current = null
        speak(story)
        return
      }
      // Not its turn yet: keep the newest story and show it when the gap ends.
      pendingStory.current = story
      clearTimeout(pendingTimer.current)
      pendingTimer.current = setTimeout(() => {
        const next = pendingStory.current
        pendingStory.current = null
        if (next && Date.now() >= silentUntil.current) speak(next)
      }, wait + 60)
    },
    [react],
  )

  const dismissAll = useCallback(() => {
    silentUntil.current = Date.now() + SILENCE_MS
    pendingStory.current = null
    clearTimeout(pendingTimer.current)
    dismiss()
  }, [dismiss])

  useEffect(() => () => clearTimeout(pendingTimer.current), [])

  // On arriving at a page: wake up, then settle into the route's pose.
  useEffect(() => {
    setAnimation('waking')
    clearTimeout(wakeRef.current)
    wakeRef.current = setTimeout(() => setAnimation(defaultPose), 1100)
    return () => clearTimeout(wakeRef.current)
  }, [defaultPose])

  // A page asked Echo to react: show that pose until the context drops it.
  useEffect(() => {
    if (pose?.name) setAnimation(pose.name)
    else setAnimation((a) => (a === 'waking' ? a : defaultPose))
  }, [pose, defaultPose])

  // ---- arrival -------------------------------------------------------------
  // The greeting waits for the boot check (so it knows who is signed in and
  // what they study), then speaks once per session. `lastVisit` is stamped on
  // the way in, so at greeting time it still holds the previous visit.
  const lastVisitAt = useRef(readLastVisit())
  const greeted = useRef(false)
  useEffect(() => {
    if (!visible || booting || greeted.current) return
    greeted.current = true
    queue(arrivalStory({ state, streak, lastVisitAt: lastVisitAt.current }))
    lastVisitAt.current = Date.now()
    stampVisit()
  }, [visible, booting, state, streak, queue])

  // ---- the idle ladder -----------------------------------------------------
  // 12s: settle into work. 45s: bored, and says so. 3m: drowsy. 10m: asleep.
  // The first movement back wakes him with a line.
  const lastActivity = useRef(Date.now())
  const idleStage = useRef(-1)
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  useEffect(() => {
    if (!visible) return
    lastActivity.current = Date.now()
    idleStage.current = -1
    const activity = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    const bump = () => {
      lastActivity.current = Date.now()
      if (idleStage.current >= 1) {
        idleStage.current = -1
        setAnimation('waking')
        clearTimeout(wakeRef.current)
        wakeRef.current = setTimeout(() => setAnimation(defaultPose), 1100)
        queue(wakeStory())
      }
    }
    activity.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    const timer = setInterval(() => {
      if (!visibleRef.current) return
      const idle = Date.now() - lastActivity.current
      const stage = idle >= 600_000 ? 3 : idle >= 180_000 ? 2 : idle >= 45_000 ? 1 : idle >= 12_000 ? 0 : -1
      if (stage <= idleStage.current) return
      idleStage.current = stage
      if (stage === 0) setAnimation('working')
      else if (stage === 1) {
        setAnimation('bored')
        queue(idleStory('bored'))
      } else if (stage === 2) {
        setAnimation('drowsy')
        queue(idleStory('drowsy'))
      } else setAnimation('sleeping')
    }, 5000)
    return () => {
      activity.forEach((e) => window.removeEventListener(e, bump))
      clearInterval(timer)
    }
  }, [visible, defaultPose, queue])

  // Where this page stands in the study state — null when the corner is off.
  const story = useMemo(() => {
    if (!visible) return null
    if (FOCUS_PATHS.includes(pathname)) {
      // Talk about the course actually on screen, not the default mission, so
      // the line's numbers always match the panel in front of the student.
      const mats = readyMaterials(state)
      const viewed =
        mats.find((m) => m.id === searchParams.get('material')) ||
        mats.find((m) => m.id === state.lastStudied?.materialId) ||
        mats[0]
      if (!viewed) return null

      const sectionId = searchParams.get('section')
      const sectionTitle = viewed.pack?.sections?.find((s) => s.id === sectionId)?.title

      if (pathname === '/app/map') {
        const bossDone = state.quizLog.some((q) => q.materialId === viewed.id && q.boss && q.defeated)
        const cs = courseStory({ prog: materialProgress(state, viewed), bossDone })
        // Include the course id so switching course re-speaks the fresh number.
        return cs ? { ...cs, key: `${cs.key}:${viewed.id}` } : null
      }

      if (pathname === '/app/notes') {
        // Smart Notes: name the topic they have open, and how far the course is.
        const ns = notesStory({ prog: materialProgress(state, viewed), sectionTitle })
        return ns ? { ...ns, key: `${ns.key}:${viewed.id}:${sectionId || ''}` } : null
      }

      if (pathname === '/app/flashcards') {
        // AI Flashcards: how much of the deck is already marked easy.
        const total = viewed.pack?.cards?.length || 0
        const easy = (state.cardsEasy[viewed.id] || []).length
        const prog = { done: easy, total, pct: total ? Math.round((easy / total) * 100) : 0 }
        const fs = cardsStory({ prog, sectionTitle })
        return fs ? { ...fs, key: `${fs.key}:${viewed.id}:${sectionId || ''}` } : null
      }

      if (pathname === '/app/quiz') {
        // Quiz Arena: quote the same course progress the learning map shows,
        // plus whether this course has been fought at all.
        const attempts = state.quizLog.filter((q) => q.materialId === viewed.id).length
        const boss = searchParams.get('boss') === '1'
        const qs = quizStory({ prog: materialProgress(state, viewed), attempts, boss, sectionTitle })
        return qs ? { ...qs, key: `${qs.key}:${viewed.id}:${boss ? 'boss' : sectionId || ''}` } : null
      }

      if (pathname === '/app/teach') {
        // Teach Echo: the same course progress, plus whether it has been taught.
        const attempts = state.teachLog.filter((t) => t.materialId === viewed.id).length
        const ts = teachStory({ prog: materialProgress(state, viewed), attempts, sectionTitle })
        return ts ? { ...ts, key: `${ts.key}:${viewed.id}:${sectionId || ''}` } : null
      }

      // A focus page with no material-based line of its own — the performance
      // page speaks through its own effect, and the generic chatter stays muted.
      return null
    }
    if (NO_COURSE_PATHS.includes(pathname)) return streakStory(state.studyDays, streak)
    return null
  }, [visible, pathname, state, streak, searchParams])

  // The story speaks once per key: Echo strikes the matching expression and
  // says its line as a floating note.
  const firedStory = useRef(null)
  useEffect(() => {
    if (!story || story.key === firedStory.current) return
    firedStory.current = story.key
    queue(story)
  }, [story, queue])

  // Achievement unlocks get their own words, not just the toast headline.
  // Every other toast stays a toast: Echo never repeats its text as a bubble.
  const lastToast = toasts[toasts.length - 1] || null
  const lastToastId = useRef(null)
  useEffect(() => {
    if (!lastToast || lastToast.id === lastToastId.current) return
    lastToastId.current = lastToast.id
    if (lastToast.meta?.achievementId) {
      if (!focused) queue(achievementStory(lastToast.meta.achievementId))
    }
  }, [lastToast, queue, focused])

  // ---- level and XP milestones --------------------------------------------
  const prevLevel = useRef(level.level)
  const prevXp = useRef(state.xp)
  const primed = useRef(false)
  useEffect(() => {
    // The first run is the page loading, not a promotion: remember the values
    // as they are and only celebrate real changes from here.
    if (!primed.current) {
      primed.current = true
      prevLevel.current = level.level
      prevXp.current = state.xp
      return
    }
    if (!focused && level.level > prevLevel.current) queue(levelStory(level.level))
    prevLevel.current = level.level

    // XP milestones only fire right after crossing one.
    if (state.xp > prevXp.current) {
      const mile = xpStory(state.xp)
      if (mile && !focused) queue(mile)
    }
    prevXp.current = state.xp
  }, [level.level, state.xp, focused, queue])

  const note = notification || speech
  const tone = notification ? notification.tone : speech?.tone || 'info'

  // Same rule as `visible`: hidden on pages with their own Echo, on the tool
  // pages without a course, and whenever Echo is switched off in Settings.
  if (!visible) return null

  return (
    <div className="companion" data-route={pathname}>
      <Echo size={140} className="companion-avatar" animation={animation} />
      <Speech text={note?.text} tone={tone} onDismiss={dismissAll} />
    </div>
  )
}

export default memo(Companion)
