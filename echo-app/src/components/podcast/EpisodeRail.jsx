import { timeAgo } from '../../lib/format.js'
import './podcast.css'

/**
 * The episodes recorded from this account's materials, newest first — the rail
 * beside the player. A row opens that episode; Delete on a row forgets it for
 * good after a confirmation.
 */
export default function EpisodeRail({ episodes, activeId, onOpen, onNew, busy }) {
  return (
    <aside className="pod-rail" aria-label="Episodes">
      <div className="pod-rail-head">
        <span className="pod-rail-label">Your episodes</span>
        <button type="button" className="btn btn-quiet" onClick={onNew} disabled={busy}>
          New episode
        </button>
      </div>

      {episodes.length === 0 ? (
        <p className="pod-rail-empty small muted">
          Nothing recorded yet. Pick a material and Echo will talk you through it.
        </p>
      ) : (
        <ul className="pod-rail-list">
          {episodes.map((episode) => (
            <li key={episode.id} className={`pod-rail-item${episode.id === activeId ? ' is-on' : ''}`}>
              <button type="button" className="pod-rail-open" onClick={() => onOpen(episode.id)} disabled={busy} title={episode.title}>
                <span className="pod-rail-title">{episode.title}</span>
                <span className="pod-rail-meta">
                  {episode.minutes} min · {episode.turns} turns
                  {episode.position > 0 ? ` · at turn ${episode.position + 1}` : ''}
                </span>
                <span className="pod-rail-meta pod-rail-when">
                  {episode.sectionTitle ? `${episode.sectionTitle} · ` : ''}
                  {episode.materialTitle} · {timeAgo(new Date(episode.createdAt).getTime())}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
