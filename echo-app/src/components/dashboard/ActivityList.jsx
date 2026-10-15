import { timeAgo } from '../../lib/format.js'
import './dashboard.css'

const KIND = { upload: 'Notes', link: 'Link', quiz: 'Quiz', teach: 'Teach', cards: 'Cards', topic: 'Topic' }

export default function ActivityList({ items }) {
  return (
    <section className="activity surface">
      <h3>Recent activity</h3>
      {items.length === 0 ? (
        <p className="muted">Nothing yet. Upload a file or open a quiz and it will show up here.</p>
      ) : (
        <ul>
          {items.map((a) => (
            <li key={a.id}>
              <span className="activity-kind">{KIND[a.type] || 'Study'}</span>
              <span className="activity-text">{a.text}</span>
              <time className="small muted">{timeAgo(a.at)}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
