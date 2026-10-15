import ProgressBar from '../ui/ProgressBar.jsx'
import './notes.css'

/** The reading rail of Smart Notes: the app sidebar's language, at document scale. */
export default function NoteToc({ title, sections, activeId, doneIds = [], onSelect }) {
  const total = sections.length
  const done = sections.filter((s) => doneIds.includes(s.id)).length

  return (
    <nav className="toc" aria-label="Table of contents">
      <div className="toc-head">
        <p className="toc-kicker">Table of contents</p>
        <p className="toc-title">{title}</p>
        {total > 0 && (
          <>
            <p className="toc-count">
              <strong>{done}</strong> of {total} done
            </p>
            <ProgressBar className="toc-bar" value={(done / total) * 100} label={`${done} of ${total} sections done`} />
          </>
        )}
      </div>
      <ol className="toc-list">
        {sections.map((s, i) => {
          const on = activeId === s.id
          return (
            <li key={s.id}>
              <button type="button" className={`toc-item${on ? ' is-on' : ''}`} onClick={() => onSelect(s.id)} aria-current={on ? 'true' : undefined}>
                <span className="toc-index" aria-hidden="true">{i + 1}</span>
                <span className="toc-label">{s.title}</span>
                {doneIds.includes(s.id) && <span className="toc-done">Done</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
