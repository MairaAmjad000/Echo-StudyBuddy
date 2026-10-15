import { clamp } from '../../lib/format.js'
import './ui.css'

/** A score written in red pen, circled. Used for Teach Echo results. */
export default function ScoreRing({ value, size = 92 }) {
  const v = clamp(value, 0, 100)
  const tone = v >= 60 ? 'ring-good' : 'ring-low'
  return (
    <div className={`score-ring ${tone}`} style={{ width: size, height: size * 0.63 }} role="img" aria-label={`Score ${v} percent`}>
      <svg viewBox="0 0 92 58" aria-hidden="true">
        <ellipse cx="46" cy="29" rx="42" ry="24" fill="none" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span>{v}%</span>
    </div>
  )
}
