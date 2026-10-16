import { useEffect, useState } from 'react'
import StatStrip from '../components/dashboard/StatStrip.jsx'
import MissionCard from '../components/dashboard/MissionCard.jsx'
import ActivityList from '../components/dashboard/ActivityList.jsx'
import Echo from '/src/strobi-avatar/Strobi.tsx'
import { welcomeStory } from '../components/mascot/scenarios.js'
import { useApp } from '../store/AppContext.jsx'
import { greeting } from '../lib/format.js'
import { avatarById } from '../lib/avatars.js'
import { pickMission, weeklyCounts } from '../lib/stats.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'
import ThemeToggle from '../components/ui/ThemeToggle.jsx'
import '../styles/pages.css'

// The greeting shown last time, so a fresh page load (which empties the
// scenario module's memory) still greets you with something new. Just the
// line — never anything about the student.
const LAST_GREET_KEY = 'echo.lastGreeting'
const readLastGreeting = () => {
  try {
    return localStorage.getItem(LAST_GREET_KEY)
  } catch {
    return null
  }
}
const rememberGreeting = (line) => {
  try {
    localStorage.setItem(LAST_GREET_KEY, line)
  } catch {
    /* storage blocked — the greeting just falls back to chance */
  }
}

export default function Dashboard() {
  useDocumentTitle('Dashboard')
  const { state, streak } = useApp()
  const weekly = weeklyCounts(state.activity)
  const mission = pickMission(state)
  const name = state.account?.name || 'there'
  const hasMaterials = state.materials.length > 0
  // The chosen profile picture, shown beside the greeting when there is one.
  const pic = state.account?.avatar ? avatarById(state.account.avatar) : null

  // Echo greets you the moment the dashboard opens: a warm hello that fits the
  // day and rotates through variants, so it never repeats itself. The pick
  // happens after mount (not during render — the pick has a memory), and it
  // re-picks when the situation truly changes.
  const [welcome, setWelcome] = useState(null)
  useEffect(() => {
    setWelcome(welcomeStory({ hasMaterials, streak, studyDays: state.studyDays, avoid: readLastGreeting() }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMaterials, streak])
  useEffect(() => {
    if (welcome) rememberGreeting(welcome.line)
  }, [welcome])

  return (
    <>
      <div className="dash-toolbar">
        <ThemeToggle />
      </div>

      <section className="greeting surface">
        <div className="greeting-copy">
          {pic && <img className="greeting-avatar" src={pic.src} alt="" width="72" height="72" />}
          <div className="greeting-text">
            <h1>
              {greeting()}, {name}.
            </h1>
            <p className="muted">{mission ? 'Ready to continue your learning journey?' : 'Upload your first notes to begin.'}</p>
          </div>
        </div>
        <div className="greeting-echo-wrap">
          {welcome && <p className={`greeting-say greeting-say-${welcome.tone}`}>{welcome.line}</p>}
          <Echo size={72} animation={welcome?.pose || 'curious'} className="greeting-echo" />
        </div>
      </section>

      <StatStrip
        items={[
          { label: 'Study streak', value: streak, note: streak === 1 ? 'Day' : 'Days in a row' },
          { label: 'XP earned', value: state.xp.toLocaleString(), note: 'Total' },
          { label: 'Notes created', value: weekly.upload, note: 'This week' },
          { label: 'Quizzes solved', value: weekly.quiz, note: 'This week' },
        ]}
      />

      <div className="dash-grid">
        <MissionCard mission={mission} />
        <ActivityList items={state.activity.slice(0, 5)} />
      </div>
    </>
  )
}
