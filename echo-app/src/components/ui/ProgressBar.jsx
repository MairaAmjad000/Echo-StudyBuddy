import { clamp } from '../../lib/format.js'
import './ui.css'

export default function ProgressBar({ value, tone = 'ink', label, className = '' }) {
  const v = clamp(Math.round(value ?? 0), 0, 100)
  return (
    <span
      className={`bar bar-${tone} ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-label={label}
    >
      <i style={{ width: `${v}%` }} />
    </span>
  )
}
