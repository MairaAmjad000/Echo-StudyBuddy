import './notes.css'

/** One section of the generated notes: summary, grouped points and key terms. */
export default function NoteSection({ section, index, done, onToggleDone, actions }) {
  return (
    <article className="note-section" id={`section-${section.id}`}>
      <h2>{index + 1}. {section.title}</h2>

      {section.summary?.length > 0 && (
        <div className="note-summary">
          {section.summary.map((p, i) => <p key={i}>{p}</p>)}
        </div>
      )}

      {section.groups?.map((g, i) => (
        <div className="note-group" key={i}>
          {g.title && <h4>{g.title}</h4>}
          <ul>
            {g.items.map((item, j) => <li key={j}>{item}</li>)}
          </ul>
        </div>
      ))}

      {section.terms?.length > 0 && (
        <div className="note-group">
          <h4>Key terms</h4>
          <dl className="note-terms">
            {section.terms.map((t) => (
              <div key={t.term}>
                <dt>{t.term}</dt>
                <dd>{t.def}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {(onToggleDone || actions) && (
        <div className="btn-row note-actions">
          {onToggleDone && (
            <button type="button" className={`btn btn-quiet${done ? ' is-done' : ''}`} onClick={onToggleDone} aria-pressed={!!done}>
              {done ? 'Marked as done' : 'Mark this topic as done'}
            </button>
          )}
          {actions}
        </div>
      )}
    </article>
  )
}
