import './dashboard.css'

/** The four headline numbers, drawn as one ruled strip rather than four separate cards. */
export default function StatStrip({ items }) {
  return (
    <dl className="stat-strip surface">
      {items.map((s) => (
        <div key={s.label}>
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
          <dd className="stat-note">{s.note}</dd>
        </div>
      ))}
    </dl>
  )
}
