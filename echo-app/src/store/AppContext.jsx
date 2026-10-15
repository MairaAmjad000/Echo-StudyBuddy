import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from '../lib/api.js'
import { emptyState } from './seed.js'
import { uid } from '../lib/format.js'
import { computeStreak, levelInfo } from '../lib/stats.js'

/**
 * App state lives on the server (MongoDB). The browser holds only the session
 * cookie — nothing user-related is written to localStorage. `state.account` and
 * `state.signedIn` are derived from the auth session; every mutating action
 * calls the API and adopts the progress returned by the server, so XP,
 * achievements and logs stay server-authoritative.
 */

// The study-state template the client expects, filled with safe defaults so
// pages can render before/without every field. Identity (`account`,
// `signedIn`) and the material list are deliberately left out: they belong to
// the session and the materials API, so a progress response can never blank
// them out and sign the student out from under a quiz or a finished topic.
function progressTemplate() {
  const { account, signedIn, materials, ...base } = emptyState()
  return base
}

function normalizeProgress(progress) {
  const base = progressTemplate()
  if (!progress) return base
  return {
    ...base,
    ...progress,
    settings: { ...base.settings, ...(progress.settings || {}) },
    sectionsDone: progress.sectionsDone || {},
    cardsEasy: progress.cardsEasy || {},
    achievements: progress.achievements || {},
    xpAwarded: progress.xpAwarded || {},
    quizLog: progress.quizLog || [],
    teachLog: progress.teachLog || [],
    xpLog: progress.xpLog || [],
    studyDays: progress.studyDays || [],
    activity: progress.activity || [],
  }
}

function normalizeUser(user) {
  return user
    ? { name: user.name, email: user.email, avatar: user.avatar || null, createdAt: user.createdAt || Date.now() }
    : null
}

// Whether this browser has ever been signed in. It tells a returning student
// whose session expired apart from a first-time visitor, so the auth page can
// say the right thing. A flag, never any account data.
const SAW_APP_KEY = 'echo.sawApp'
const markSawApp = () => {
  try {
    localStorage.setItem(SAW_APP_KEY, '1')
  } catch {
    /* storage blocked — the greeting just plays it safe */
  }
}
const clearSawApp = () => {
  try {
    localStorage.removeItem(SAW_APP_KEY)
  } catch {
    /* ignore */
  }
}
export const sawApp = () => {
  try {
    return localStorage.getItem(SAW_APP_KEY) === '1'
  } catch {
    return false
  }
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [booting, setBooting] = useState(true)
  const [state, setState] = useState(emptyState())
  const [toasts, setToasts] = useState([])
  // Set only when the boot check could not reach the server at all. A 401 is
  // not an error — it just means nobody is signed in yet.
  const [bootError, setBootError] = useState(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const toast = useCallback((message, tone = 'info', meta) => {
    const id = uid('t')
    setToasts((t) => [...t, { id, message, tone, meta }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  // Adopt the server's progress after any mutation, and celebrate achievement unlocks.
  const adopt = useCallback(
    (data) => {
      if (data?.progress) setState((s) => ({ ...s, ...normalizeProgress(data.progress) }))
      // The id rides along so Echo can say his own line for that achievement.
      ;(data?.unlocked || []).forEach((a) => toast(`Achievement unlocked: ${a.title}`, 'success', { achievementId: a.id }))
    },
    [toast],
  )

  // Boot: ask the server who we are. The cookie decides; localStorage is never
  // read for account data. A dead server is kept apart from "not signed in" so
  // the app can offer a retry instead of bouncing a student to the login page.
  const boot = useCallback(async () => {
    setBooting(true)
    setBootError(null)
    try {
      const { user, progress } = await api.get('/api/auth/me')
      const materials = await api.get('/api/materials')
      setState({ ...normalizeProgress(progress), account: normalizeUser(user), signedIn: true, materials })
      markSawApp()
    } catch (e) {
      setState(emptyState())
      const notSignedIn = e instanceof ApiError && (e.status === 401 || e.status === 403)
      if (!notSignedIn) setBootError(e)
    } finally {
      setBooting(false)
    }
  }, [])

  useEffect(() => {
    boot()
  }, [boot])

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', !!state.settings.reduceMotion)
  }, [state.settings.reduceMotion])

  const applyOptimistic = useCallback((fn) => setState((s) => fn(s)), [])

  const actions = useMemo(
    () => ({
      async signUp(name, email, password) {
        await api.post('/api/auth/signup', { name, email, password })
        const { user, progress } = await api.get('/api/auth/me')
        const materials = await api.get('/api/materials')
        setState({ ...normalizeProgress(progress), account: normalizeUser(user), signedIn: true, materials })
        markSawApp()
        return 'ok'
      },
      async logIn(email, password) {
        await api.post('/api/auth/login', { email, password })
        const { user, progress } = await api.get('/api/auth/me')
        const materials = await api.get('/api/materials')
        setState({ ...normalizeProgress(progress), account: normalizeUser(user), signedIn: true, materials })
        markSawApp()
        return 'ok'
      },
      async signOut() {
        try { await api.post('/api/auth/logout') } catch { /* session may be gone */ }
        setState(emptyState())
        clearSawApp()
        return 'ok'
      },
      async rename(name) {
        await api.patch('/api/auth/me', { name })
        setState((s) => ({ ...s, account: { ...s.account, name } }))
      },
      /** Choose a profile picture. The server checks it against the level. */
      async setAvatar(id) {
        const { user } = await api.patch('/api/auth/me', { avatar: id })
        setState((s) => ({ ...s, account: normalizeUser(user) }))
      },

      async refreshMaterials() {
        const materials = await api.get('/api/materials')
        setState((s) => ({ ...s, materials }))
        return materials
      },

      async addMaterial(payload) {
        // The server owns ids; the returned material carries the Mongo _id as `id`.
        const data = await api.post('/api/materials', payload)
        setState((s) => ({ ...s, ...normalizeProgress(data.progress), materials: [data.material, ...s.materials.filter((m) => m.id !== data.material.id)] }))
        return data.material
      },
      async completeMaterial(id, { transcript, ...patch }) {
        const data = await api.patch(`/api/materials/${id}`, { transcript, ...patch })
        setState((s) => ({
          ...s,
          ...normalizeProgress(data.progress),
          materials: s.materials.map((m) => (m.id === id ? data.material : m)),
        }))
      },
      async removeMaterial(id) {
        await api.del(`/api/materials/${id}`)
        setState((s) => ({
          ...s,
          materials: s.materials.filter((m) => m.id !== id),
          sectionsDone: Object.fromEntries(Object.entries(s.sectionsDone).filter(([k]) => k !== id)),
          cardsEasy: Object.fromEntries(Object.entries(s.cardsEasy).filter(([k]) => k !== id)),
          lastStudied: s.lastStudied?.materialId === id ? null : s.lastStudied,
        }))
      },
      touch(materialId, sectionId) {
        applyOptimistic((s) => (s.lastStudied?.materialId === materialId && s.lastStudied?.sectionId === sectionId ? s : { ...s, lastStudied: { materialId, sectionId } }))
        api.post('/api/progress/last-studied', { materialId, sectionId }).catch(() => {})
      },
      async toggleSectionDone(materialId, sectionId, title) {
        const cur = stateRef.current.sectionsDone[materialId] || []
        const done = !cur.includes(sectionId)
        applyOptimistic((s) => ({
          ...s,
          sectionsDone: { ...s.sectionsDone, [materialId]: done ? [...cur, sectionId] : cur.filter((x) => x !== sectionId) },
          lastStudied: { materialId, sectionId },
        }))
        try {
          adopt(await api.patch(`/api/progress/sections/${materialId}`, { sectionId, title, done }))
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) throw e
          toast('Could not save that. Retrying on the next change.', 'error')
        }
      },

      async recordQuiz({ materialId, correct, total, defeated, fast, boss = false }) {
        const data = await api.post('/api/progress/quiz', { materialId, correct, total, defeated, fast, boss })
        adopt(data)
        return data.xp
      },
      async recordCards({ materialId, easyIds, hardCount }) {
        const data = await api.post('/api/progress/cards', { materialId, easyIds, hardCount })
        adopt(data)
        return data.xp
      },
      async recordTeach({ materialId, sectionId, topic, score }) {
        const data = await api.post('/api/progress/teach', { materialId, sectionId, topic, score })
        adopt(data)
        return data.xp
      },

      /**
       * Chat with Echo. The page owns the thread; the server stores it too so it
       * shows up in the history list. Pass the sessionId from the previous
       * answer to keep appending to the same conversation, and the reply plus
       * the (possibly new) sessionId come back. Gemini reads the whole thread
       * plus the material to answer.
       */
      async askEcho(materialId, messages, sessionId) {
        const data = await api.post('/api/chat', {
          materialId,
          sessionId: sessionId || undefined,
          messages: messages.map(({ role, content }) => ({ role, content })),
        })
        return { reply: data.reply, sessionId: data.sessionId }
      },

      /** The stored conversations, newest first. */
      async listChats() {
        const { sessions } = await api.get('/api/chat/sessions')
        return sessions
      },
      async loadChat(id) {
        return api.get(`/api/chat/sessions/${id}`)
      },
      async deleteChat(id) {
        await api.del(`/api/chat/sessions/${id}`)
        return 'ok'
      },

      async updateSettings(patch) {
        applyOptimistic((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
        try {
          adopt(await api.patch('/api/progress/settings', patch))
        } catch { /* keep the optimistic value */ }
      },
      async loadDemo() {
        try {
          adopt(await api.post('/api/progress/demo'))
        } catch (e) {
          toast(e.message || 'Upload something first, then load the demo.', 'error')
        }
      },
      async clearProgress() {
        adopt(await api.post('/api/progress/reset'))
      },
      async resetAll() {
        await api.del('/api/auth/account')
        setState(emptyState())
        clearSawApp()
      },
      exportData: () => JSON.stringify(stateRef.current, null, 2),
      toast,
      dismissToast,
    }),
    [adopt, applyOptimistic, toast, dismissToast],
  )

  // Streak and level are computed from the server-synced progress, like before.
  const streak = useMemo(() => computeStreak(state.studyDays), [state.studyDays])
  const level = useMemo(() => levelInfo(state.xp), [state.xp])

  const value = useMemo(
    () => ({ state, actions, toasts, booting, bootError, retryBoot: boot, streak, level }),
    [state, actions, toasts, booting, bootError, boot, streak, level],
  )
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
