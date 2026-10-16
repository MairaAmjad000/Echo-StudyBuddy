import { useEffect, useMemo, useState } from 'react'
import './map.css'

/**
 * The learning map: one continuous winding trail, drawn to the shape that
 * fits the screen. On a wide panel that is the board — a serpentine SVG
 * route whose labels live inside the viewBox, so it fills the panel with no
 * scrollbar. On a phone the board would shrink its labels into unreadable
 * specks, so the trail stands up: the same dashed road winds down between
 * alternating cards, and the boss waits on its dark ground at the end.
 *
 * `stops` is [{ id, title, status: 'done' | 'current' | 'locked', boss? }].
 */
export default function CourseMap({ stops, selectedId, onSelect, interactive = true, fit = false }) {
  const wide = useMediaQuery('(min-width: 640px)')
  const narrow = !wide
  const cols = fit ? 5 : wide ? 6 : 5

  // Geometry (viewBox units). The board scales with its container.
  const W = 1000
  const ROW_STEP = 250
  const xs = useMemo(
    () => Array.from({ length: cols }, (_, i) => ((i + 0.5) / cols) * W),
    [cols],
  )
  const ys = [64, 156] // alternating high / low so the trail waves

  const pts = useMemo(() => {
    const out = stops.map((s, i) => {
      const row = Math.floor(i / cols)
      const idx = i % cols
      const col = row % 2 ? cols - 1 - idx : idx // serpentine columns
      return { ...s, x: xs[col], y: ys[i % ys.length] + row * ROW_STEP }
    })
    return out
  }, [stops, cols, xs])

  // Room for the labels below the nodes — enough headroom on the bottom
  // rows so nothing runs into the panel's bottom edge.
  const H = pts.length ? pts[pts.length - 1].y + 300 : 200

  // Smooth curve through every point, snaking down the board.
  const track = useMemo(() => smoothPath(pts), [pts])

  const reached = pts.findLastIndex((p) => p.status !== 'locked')
  const walked = useMemo(() => (reached > 0 ? smoothPath(pts.slice(0, reached + 1)) : ''), [pts, reached])

  if (!stops.length) return null

  // The phone layout: rows of a fixed step so the trail behind them always
  // lands on card centres, however many topics the course has.
  if (narrow) {
    const STEP = 90 // card height + the gap
    const CARD = 76
    const anchor = (i) => ({ x: i % 2 === 0 ? 310 : 30, y: i * STEP + CARD / 2 })
    const seg = (from, to) => {
      if (to <= from) return `M${anchor(from).x} ${anchor(from).y}`
      const d = [`M${anchor(from).x} ${anchor(from).y}`]
      for (let i = from + 1; i <= to; i += 1) {
        const a = anchor(i - 1)
        const b = anchor(i)
        d.push(`C${a.x} ${a.y + 40} ${b.x} ${b.y - 40} ${b.x} ${b.y}`)
      }
      return d.join(' ')
    }
    const JH = (stops.length - 1) * STEP + CARD

    return (
      <div className="map-journey">
        {/* One road, one look: the dotted trail runs the whole way down with
            no highlighted "walked" section — on a phone the heavy blue line
            read as a dark scar across the cards. Progress lives on the cards
            themselves (ticks, the blue ring, the padlocks). */}
        <svg className="journey-map" viewBox={`0 0 340 ${JH}`} preserveAspectRatio="none" aria-hidden="true">
          <path className="trail-base" d={seg(0, stops.length - 1)} fill="none" vectorEffect="non-scaling-stroke" />
        </svg>

        {stops.map((s) => {
          const canOpen = interactive && s.status !== 'locked' && onSelect
          return (
            <button
              key={s.id}
              type="button"
              className={`journey-stop is-${s.status}${s.boss ? ' is-boss' : ''}${selectedId === s.id ? ' is-selected' : ''}`}
              disabled={!canOpen}
              aria-current={s.status === 'current' ? 'step' : undefined}
              onClick={canOpen ? () => onSelect(s.id) : undefined}
            >
              <span className="journey-node">{nodeGlyph(s)}</span>
              <span className="journey-body">
                <span className="journey-title">{s.title}</span>
                {s.status === 'current' && <span className="journey-here">You are here</span>}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="course-map">
      <svg className="map-trail" viewBox={`0 0 ${W} ${H}`} role={interactive ? 'group' : undefined} aria-label="Course map">
        <path d={track} fill="none" className="trail-base" />
        {walked && <path d={walked} fill="none" className="trail-done" />}

        {pts.map((p) => renderStop(p))}
      </svg>
    </div>
  )

  function renderStop(p) {
    const done = p.status === 'done'
    const current = p.status === 'current'
    const locked = p.status === 'locked'
    const canOpen = interactive && !locked && onSelect
    const selected = selectedId === p.id
    const boss = !!p.boss
    const r = boss ? 32 : 26
    const lines = wrap(p.title, boss ? 10 : 14)
    // Labels always sit below their node with a clear gap, so they never
    // collide with the nodes beside them.
    const baseY = p.y + r + 26
    return (
      <g
        key={p.id}
        className={`trail-stop is-${p.status}${selected ? ' is-selected' : ''}${canOpen ? ' is-clickable' : ''}`}
        role={canOpen ? 'button' : undefined}
        tabIndex={canOpen ? 0 : undefined}
        aria-label={canOpen ? `${p.title}, ${done ? 'finished' : 'open'}` : undefined}
        onClick={canOpen ? () => onSelect(p.id) : undefined}
        onKeyDown={canOpen ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(p.id)) : undefined}
      >
        {selected && <circle cx={p.x} cy={p.y} r={r + 9} fill="none" className="ring" />}
        {boss ? (
          <>
            <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} rx={16} className="node-boss" />
            <text x={p.x} y={p.y + 9} textAnchor="middle" className="boss-face">
              {done ? '✓' : current ? '!' : '★'}
            </text>
          </>
        ) : (
          <>
            <circle cx={p.x} cy={p.y} r={r} className={`node${done ? ' node-done' : current ? ' node-current' : ' node-locked'}`} />
            {done && (
              <path d={`M${p.x - 9} ${p.y} l5.5 5.5 l11 -12`} fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            )}
            {current && <circle cx={p.x} cy={p.y} r="7" fill="currentColor" strokeWidth="0" />}
            {locked && (
              <g fill="currentColor">
                <rect x={p.x - 8} y={p.y - 2} width="16" height="12" rx="3.5" />
                <path d={`M${p.x - 4.5} ${p.y - 2} v-3.5 a4.5 4.5 0 0 1 9 0 V${p.y - 2}`} fill="none" stroke="currentColor" strokeWidth="3" />
              </g>
            )}
          </>
        )}

        {lines.map((line, i) => (
          <text key={i} x={p.x} y={baseY + i * 20} textAnchor="middle" className="trail-label">
            {line}
          </text>
        ))}
        {current && (
          <text x={p.x} y={baseY + lines.length * 20 + 6} textAnchor="middle" className="trail-here">
            You are here
          </text>
        )}
      </g>
    )
  }
}

/** The glyph inside a journey card's node circle. */
function nodeGlyph(s) {
  if (s.boss) return s.status === 'done' ? '✓' : s.status === 'current' ? '!' : '★'
  if (s.status === 'done') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path className="tick" d="M6 12.5 10 16.5 18 8" />
      </svg>
    )
  }
  if (s.status === 'current') return <i />
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="3" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  )
}

/** A smooth curve through every point, snaking down the board. */
function smoothPath(pts) {
  if (!pts.length) return ''
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y}`
  const d = [`M${pts[0].x} ${pts[0].y}`]
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1]
    const b = pts[i]
    const k = Math.abs(b.x - a.x) * 0.5 * Math.sign(b.x - a.x || 1)
    d.push(`C${a.x + k} ${a.y} ${b.x - k} ${b.y} ${b.x} ${b.y}`)
  }
  return d.join(' ')
}

/** Split a title into at most two lines of about `max` characters. */
function wrap(title, max = 16) {
  const words = String(title || '').split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > max && line) {
      lines.push(line)
      line = w
    } else line = (line + ' ' + w).trim()
  }
  if (line) lines.push(line)
  if (lines.length > 2) return [lines[0], lines.slice(1).join(' ').slice(0, max - 1) + '…']
  return lines
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    // The map resizes whenever the viewport changes, so keep it real-time.
    mq.addEventListener('change', on)
    window.addEventListener('resize', on)
    return () => {
      mq.removeEventListener('change', on)
      window.removeEventListener('resize', on)
    }
  }, [query])
  return matches
}
