import EchoMark from '../brand/EchoMark.jsx'
import ScoreRing from '../ui/ScoreRing.jsx'
import { feedbackLine } from '../../lib/score.js'
import './teach.css'

/** Teach Echo result: what was covered, what was missed, and the hint for each missed point. */
export default function FeedbackPanel({ result, xp, onRetry }) {
  return (
    <section className="feedback surface" aria-label="Feedback">
      <div className="feedback-head">
        <EchoMark size={44} />
        <p className="feedback-line">{feedbackLine(result.score)}</p>
        <ScoreRing value={result.score} />
      </div>

      {result.covered.length > 0 && (
        <div className="feedback-group">
          <h4>You covered</h4>
          <ul className="fb-list fb-ok">
            {result.covered.map((k) => <li key={k.id}>{k.label}</li>)}
          </ul>
        </div>
      )}

      {result.missed.length > 0 && (
        <div className="feedback-group">
          <h4>You missed</h4>
          <ul className="fb-list fb-miss">
            {result.missed.map((k) => (
              <li key={k.id}>
                <strong>{k.label}.</strong> {k.hint}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={onRetry}>Try again</button>
        {xp > 0 && <span className="small muted">+{xp} XP</span>}
      </div>
    </section>
  )
}
