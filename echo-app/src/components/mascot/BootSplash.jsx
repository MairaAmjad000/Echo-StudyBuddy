import { useEffect, useState } from 'react'
import Echo from '/src/strobi-avatar/Strobi.tsx'

// How long Echo sleeps in the center of the page, and how long the wake
// splash gets before the app takes over.
const SLEEP_MS = 1300
const WAKE_MS = 1000

/**
 * The boot splash: Echo sleeps just below the "Waking Echo up..." line, then
 * rouses with a splash. `ready` turns true once the boot check has settled;
 * the wake scene always finishes first, so it is never cut in half.
 */
export default function BootSplash({ ready, onDone }) {
  const [phase, setPhase] = useState('sleep') // 'sleep' | 'wake' | 'done'

  useEffect(() => {
    const t = setTimeout(() => setPhase('wake'), SLEEP_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (phase !== 'wake') return undefined
    const t = setTimeout(() => setPhase('done'), WAKE_MS)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase === 'done' && ready) onDone()
  }, [phase, ready, onDone])

  return (
    <div className="boot-splash" role="status" aria-live="polite">
      <p className="muted">Waking Echo up...</p>
      <div className="boot-splash-stage">
        {phase === 'wake' && <span className="companion-splash boot-splash-burst" aria-hidden="true" />}
        {phase === 'sleep' && <span className="boot-splash-zzz" aria-hidden="true">Z z z</span>}
        <Echo size={150} animation={phase === 'sleep' ? 'sleeping' : 'waking'} />
      </div>
    </div>
  )
}
