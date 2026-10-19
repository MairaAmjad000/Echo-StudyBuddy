import { useEffect, useRef, useState } from 'react'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'
import { mmss } from '../../lib/format.js'
import useEpisodePlayer, { RATES } from '../../hooks/useEpisodePlayer.js'
import { useApp } from '../../store/AppContext.jsx'
import './podcast.css'

/** A flat triangle and two bars — the app has no icon set and no emoji. */
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
      <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
      <rect x="7" y="5.5" width="3.6" height="13" fill="currentColor" />
      <rect x="13.4" y="5.5" width="3.6" height="13" fill="currentColor" />
    </svg>
  )
}

/**
 * The player: transport, running time, the script as it is spoken, and the two
 * things a student does with an episode afterwards — keep it as an MP3, or drop
 * it. The turn being played is highlighted in the script and scrolled into
 * view, so the page reads like a transcript of a conversation that is happening
 * right now.
 *
 * Playback itself lives in useEpisodePlayer(); this component is the surface
 * over it.
 */
export default function EpisodePlayer({ episode, hosts, onTurnChange, onSavePosition, onDelete }) {
  const { state } = useApp()
  const player = useEpisodePlayer(episode, { onTurnChange, onSavePosition })
  const [confirming, setConfirming] = useState(false)
  const activeRef = useRef(null)
  const listRef = useRef(null)
  const reduceMotion = !!state.settings.reduceMotion

  // Follow along: keep the turn being played visible. Playback is the user's
  // own action, so this scrolls only when the transcript is the thing they are
  // watching — never on the first paint, where the top of the script is right.
  const shifted = useRef(false)
  useEffect(() => {
    shifted.current = false
  }, [episode.id])
  useEffect(() => {
    if (!shifted.current) {
      shifted.current = true
      return
    }
    const node = activeRef.current
    const list = listRef.current
    if (!node || !list) return
    const line = node.getBoundingClientRect()
    const view = list.getBoundingClientRect()
    // Below the fold: bring the line to the top of the script. Above it: just
    // put it back in sight. Either way the played line stays readable.
    if (line.bottom > view.bottom) list.scrollTo({ top: list.scrollTop + (line.bottom - view.bottom) + 10, behavior: reduceMotion ? 'auto' : 'smooth' })
    else if (line.top < view.top) list.scrollTo({ top: Math.max(0, list.scrollTop - (view.top - line.top) - 10), behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [player.index, reduceMotion])

  const minutes = Math.max(1, Math.round(player.totalSeconds / 60))
  const percent = player.totalSeconds ? Math.min(100, (player.positionSeconds / player.totalSeconds) * 100) : 0
  const resumable = episode.position > 0 && player.index === 0 && !player.playing

  return (
    <section className="pod-player surface">
      <header className="pod-head">
        <img className="pod-cover" src="/echo.png" alt="" width="88" height="88" />
        <div className="pod-head-main">
          <p className="pod-kicker">
            {episode.sectionTitle ? `One topic from ${episode.materialTitle}` : episode.materialTitle ? `From ${episode.materialTitle}` : 'Study Session'}
          </p>
          <h2 className="pod-title">{episode.title}</h2>
          <p className="pod-meta">
            {hosts.echo} and {hosts.milo} · {episode.turns} turns · about {minutes} min · {episode.presetLabel}
            {episode.source === 'built-in' ? ' · written from your notes' : ''}
          </p>
        </div>
        <div className="pod-head-actions">
          <label className="field pod-rate">
            <span>Speed</span>
            <select value={player.rate} onChange={(e) => player.setRate(Number(e.target.value))} aria-label="Playback speed">
              {RATES.map((r) => (
                <option key={r} value={r}>
                  {r}×{r === 1 ? ' (normal)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-quiet" onClick={player.save} disabled={player.busy || !!player.download}>
            {player.download ? `Saving ${player.download.done}/${player.download.total}` : 'Save as MP3'}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)} disabled={!!player.download}>
            Delete
          </button>
        </div>
      </header>

      <div className="pod-transport">
        <div className="pod-controls">
          <button type="button" className="pod-skip" onClick={() => player.seekBy(-10)} aria-label="Back ten seconds">
            −10s
          </button>
          <button
            type="button"
            className="pod-play"
            onClick={player.toggle}
            aria-label={player.playing ? 'Pause' : 'Play'}
            aria-pressed={player.playing}
          >
            {player.busy ? <span className="pod-spin" aria-hidden="true" /> : player.playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button type="button" className="pod-skip" onClick={() => player.seekBy(10)} aria-label="Forward ten seconds">
            +10s
          </button>
        </div>

        <div className="pod-progress">
          <div className="pod-bar" role="img" aria-label="Episode progress">
            <span className="pod-bar-fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="pod-progress-row">
            <span className="small muted">
              {mmss(player.positionSeconds)} / {mmss(player.totalSeconds)}
            </span>
            <span className="small muted">
              Turn {player.index + 1} of {episode.turns}
            </span>
          </div>
          {resumable && (
            <button type="button" className="pod-resume" onClick={() => player.play(episode.position)}>
              Pick up at turn {episode.position + 1}
            </button>
          )}
        </div>

        <div className="pod-turn-nav">
          <button type="button" className="btn btn-quiet" onClick={player.prev} disabled={player.index === 0 || player.busy}>
            Previous
          </button>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={player.next}
            disabled={player.index >= episode.turns - 1 || player.busy}
          >
            Next
          </button>
        </div>
      </div>

      {player.error && (
        <p className="pod-error" role="status">
          {player.error}{' '}
          <button type="button" className="btn-text small" onClick={() => player.play(player.index)}>
            Try again
          </button>
        </p>
      )}

      <div className="pod-transcript">
        <h3>Script</h3>
        <ol ref={listRef}>
          {episode.segments.map((s, i) => {
            const on = i === player.index
            return (
              <li
                key={s.id}
                className={`pod-turn pod-turn-${s.speaker}${on ? ' is-on' : ''}`}
                ref={on ? activeRef : null}
              >
                <button type="button" className="pod-turn-btn" onClick={() => player.play(i)} disabled={player.busy && !on}>
                  <span className="pod-turn-who">{hosts[s.speaker]}</span>
                  <span className="pod-turn-time">{mmss(player.turnSeconds(i))}</span>
                  <span className="pod-turn-text">{s.text}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Delete this episode?"
          message={`“${episode.title}” and where you stopped in it are removed. Your material and its notes stay. This cannot be undone.`}
          confirmLabel="Delete it"
          danger
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            onDelete(episode)
          }}
        />
      )}
    </section>
  )
}
