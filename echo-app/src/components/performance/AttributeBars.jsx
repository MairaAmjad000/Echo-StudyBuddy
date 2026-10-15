import ProgressBar from '../ui/ProgressBar.jsx'
import './performance.css'

/**
 * The five attributes as bars. `stats` is [{ key, label, value | null, source }].
 * The lowest value (when there are at least two) is drawn in red pen.
 */
export default function AttributeBars({ stats }) {
  const withData = stats.filter((s) => s.value !== null)
  const lowest = withData.length >= 2 ? withData.reduce((a, b) => (b.value < a.value ? b : a)) : null

  return (
    <dl className="attrs">
      {stats.map((s) => {
        const low = lowest?.key === s.key
        return (
          <div key={s.key} className={low ? 'is-low' : ''}>
            <dt>{s.label}</dt>
            <dd>
              <ProgressBar value={s.value ?? 0} tone={low ? 'pen' : 'ink'} label={`${s.label}${s.value === null ? ', no data yet' : ''}`} />
              <b>{s.value === null ? '--' : `${s.value}%`}</b>
            </dd>
            <dd className="attr-source">{s.value === null ? `No data yet. Source: ${s.source.toLowerCase()}.` : low ? `Lowest right now. Source: ${s.source.toLowerCase()}.` : s.source}</dd>
          </div>
        )
      })}
    </dl>
  )
}
