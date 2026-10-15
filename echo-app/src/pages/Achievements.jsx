import { useEffect } from 'react'
import PageHeader from '../components/ui/PageHeader.jsx'
import ProgressBar from '../components/ui/ProgressBar.jsx'
import { useApp } from '../store/AppContext.jsx'
import { useCompanion } from '../components/mascot/companion-context.jsx'
import { nearMissStory } from '../components/mascot/scenarios.js'
import { ACHIEVEMENTS } from '../lib/achievements.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'
import '../styles/pages.css'

export default function Achievements() {
  useDocumentTitle('Achievements')
  const { state } = useApp()
  const companion = useCompanion()
  const unlocked = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length

  // The closest locked achievement gets a nudge, once per visit.
  useEffect(() => {
    const locked = ACHIEVEMENTS.filter((a) => !state.achievements[a.id])
      .map((a) => {
        const [cur, target] = a.progress(state)
        return { title: a.title, cur, target, ratio: target ? cur / target : 0 }
      })
      .filter((a) => a.ratio >= 0.8)
      .sort((a, b) => b.ratio - a.ratio)
    const story = nearMissStory(locked)
    if (story) companion.react(story.pose, story.line, story.tone, story.ms)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <PageHeader title="Achievements" subtitle={`${unlocked} of ${ACHIEVEMENTS.length} unlocked.`} />
      <div className="side-by-side">
        <ul className="achievements surface">
          {ACHIEVEMENTS.map((a) => {
            const [cur, target] = a.progress(state)
            const at = state.achievements[a.id]
            return (
              <li key={a.id} className={at ? 'is-unlocked' : ''}>
                <div>
                  <h3>{a.title}</h3>
                  <p className="muted">{a.text}</p>
                </div>
                <div className="ach-progress">
                  <ProgressBar value={(Math.min(cur, target) / target) * 100} tone={at ? 'blue' : 'ink'} label={`${a.title} progress`} />
                  <span className="small">
                    {at ? `Unlocked ${new Date(at).toLocaleDateString()}` : `${Math.min(cur, target)} / ${target}`}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>

      </div>
    </>
  )
}
