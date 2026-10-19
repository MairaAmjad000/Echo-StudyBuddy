import { timeAgo } from '../../lib/format.js'
import './whiteboard.css'

/**
 * The lessons this account has solved, newest first — the rail beside the
 * board. A row reopens a lesson from the server, so revisiting one costs no AI
 * call. Delete asks the page to confirm before forgetting it.
 */
export default function LessonRail({ lessons, activeId, onOpen, onNew, onDelete, busy }) {
  return (
    <aside className="wb-rail" aria-label="Recent lessons">
      <div className="wb-rail-head">
        <span className="wb-rail-label">Recent lessons</span>
        <button type="button" className="btn btn-quiet wb-new" onClick={onNew} disabled={busy}>
          New
        </button>
      </div>

      {lessons.length === 0 ? (
        <p className="wb-rail-empty small muted">Nothing on the board yet. Ask a question and the lesson stays here.</p>
      ) : (
        <ul className="wb-rail-list">
          {lessons.map((lesson) => (
            <li key={lesson.id} className={`wb-rail-item${lesson.id === activeId ? ' is-on' : ''}`}>
              <button
                type="button"
                className="wb-rail-open"
                onClick={() => onOpen(lesson.id)}
                disabled={busy}
                title={lesson.title}
              >
                <span className="wb-rail-title">{lesson.title}</span>
                <span className="wb-rail-meta">
                  {lesson.subject} · {lesson.steps} {lesson.steps === 1 ? 'step' : 'steps'}
                </span>
                <span className="wb-rail-when">
                  {lesson.source === 'photo' ? 'Photo · ' : ''}
                  {timeAgo(new Date(lesson.createdAt).getTime())}
                </span>
              </button>
              <button
                type="button"
                className="wb-rail-delete"
                onClick={() => onDelete(lesson)}
                disabled={busy}
                aria-label={`Delete lesson ${lesson.title}`}
                title="Delete lesson"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
