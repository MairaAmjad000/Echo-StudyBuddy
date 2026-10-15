import Button from '../ui/Button.jsx'
import ProgressBar from '../ui/ProgressBar.jsx'
import './dashboard.css'

/** Today's Mission: the next unfinished topic of the course studied last. */
export default function MissionCard({ mission }) {
  if (!mission) {
    return (
      <section className="mission surface">
        <h3>Today's mission</h3>
        <p className="muted">You have nothing to study yet. Upload a file and Echo will pick the first topic.</p>
        <Button to="/app/materials">Upload your first notes</Button>
      </section>
    )
  }
  const { material, section, index, complete, pct, done, total } = mission
  const q = `material=${material.id}&section=${section.id}`
  return (
    <section className="mission surface">
      <h3>Today's mission</h3>
      <div>
        <p className="mission-title">{material.title}</p>
        <p className="muted">
          {complete ? 'Every topic is finished.' : `Topic ${index + 1} of ${total}: ${section.title}`}
        </p>
      </div>
      <div className="mission-progress">
        <ProgressBar value={pct} tone="blue" label={`${material.title} progress`} />
        <span>{pct}%</span>
      </div>
      <p className="small muted">{done} of {total} topics done</p>
      {complete ? (
        <Button to={`/app/map?material=${material.id}`}>Go to the boss round</Button>
      ) : (
        <Button to={`/app/notes?${q}`}>Continue</Button>
      )}
    </section>
  )
}
