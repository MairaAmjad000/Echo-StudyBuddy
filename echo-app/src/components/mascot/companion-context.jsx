import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { POSE_EVENTS } from './strobi-poses.js'/**
 * Echo's companion context.
 *
 * Everything the buddy does goes through here so pages never touch the avatar
 * runtime directly:
 *  - `notice(text, tone)`  — a short note that floats above Echo
 *  - `say(text, tone)`     — a longer-lived note (e.g. while listening)
 *  - `react(pose, text, tone, ms)`
 *     — makes Echo strike a pose for a moment (`POSE_EVENTS` maps the old
 *       event names like 'cheerful' or 'jump' onto real avatar animations), and
 *       optionally says a line while it does. This is how MCQs, battles,
 *       flashcards and Teach Echo reach the avatar on every page.
 *  - `pose`                — the current override (null => route default)
 */

const CompanionContext = createContext(null)

export function CompanionProvider({ children }) {
  const [speech, setSpeech] = useState(null) // { text, tone }
  const [notification, setNotification] = useState(null) // { text, tone, id }
  const [pose, setPose] = useState(null) // { name, id }
  const speechTimer = useRef(null)
  const noticeTimer = useRef(null)
  const poseTimer = useRef(null)

  const say = useCallback((text, tone = 'info', ms = 0) => {
    setSpeech(text ? { text, tone } : null)
    clearTimeout(speechTimer.current)
    if (ms > 0) speechTimer.current = setTimeout(() => setSpeech(null), ms)
  }, [])

  const notice = useCallback(
    (text, tone = 'info', ms = 4500) => {
      setNotification({ text, tone, id: uid('n') })
      clearTimeout(noticeTimer.current)
      noticeTimer.current = setTimeout(() => setNotification(null), ms)
    },
    [],
  )

  const clearPose = useCallback(() => {
    clearTimeout(poseTimer.current)
    poseTimer.current = null
    setPose(null)
  }, [])

  const react = useCallback(
    (event, text, tone = 'info', ms = 3500) => {
      const name = POSE_EVENTS[event] || event // pass a raw animation name too
      if (!name) return
      setPose({ name, id: uid('p') })
      clearTimeout(poseTimer.current)
      poseTimer.current = setTimeout(() => setPose(null), ms)
      if (text) notice(text, tone, Math.max(ms, 4500))
    },
    [notice],
  )

  const dismiss = useCallback(() => {
    setSpeech(null)
    setNotification(null)
    clearPose()
    clearTimeout(speechTimer.current)
    clearTimeout(noticeTimer.current)
  }, [clearPose])

  useEffect(
    () => () => {
      clearTimeout(speechTimer.current)
      clearTimeout(noticeTimer.current)
      clearTimeout(poseTimer.current)
    },
    [],
  )

  const value = useMemo(
    () => ({ speech, notification, pose, say, notice, react, dismiss }),
    [speech, notification, pose, say, notice, react, dismiss],
  )

  return <CompanionContext.Provider value={value}>{children}</CompanionContext.Provider>
}

export function useCompanion() {
  const ctx = useContext(CompanionContext)
  if (!ctx) throw new Error('useCompanion must be used inside <CompanionProvider>')
  return ctx
}

function uid(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
