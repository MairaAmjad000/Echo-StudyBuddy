import './performance.css'

const W = 600
const H = 240
const M = { l: 48, r: 16, t: 16, b: 34 }

const niceMax = (v) => {
  if (v <= 10) return 10
  const p = 10 ** Math.floor(Math.log10(v))
  return Math.ceil(v / p) * p
}

const short = (n) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(n))

/** A plain SVG line chart. `points` is [{ label, value }]. */
export default function LineChart({ points, unit = 'XP' }) {
  const max = niceMax(Math.max(...points.map((p) => p.value), 1))
  const iw = W - M.l - M.r
  const ih = H - M.t - M.b
  const x = (i) => M.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw)
  const y = (v) => M.t + ih - (v / max) * ih
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t))
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const empty = points.every((p) => p.value === 0)

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${unit} earned per period: ${points.map((p) => `${p.label} ${p.value}`).join(', ')}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="#d6e2f0" />
            <text x={M.l - 8} y={y(t) + 4} textAnchor="end" className="chart-tick">{short(t)}</text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={p.label + i} x={x(i)} y={H - 10} textAnchor="middle" className="chart-tick">{p.label}</text>
        ))}
        <path d={line} fill="none" stroke="#1f5fe0" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r="5" fill="#fff" stroke="#1f5fe0" strokeWidth="3">
            <title>{`${p.label}: ${p.value} ${unit}`}</title>
          </circle>
        ))}
      </svg>
      {empty && <figcaption className="small muted">No XP earned in this period yet.</figcaption>}
    </figure>
  )
}
