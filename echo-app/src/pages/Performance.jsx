import { useEffect, useState } from 'react'
import PageHeader from '../components/ui/PageHeader.jsx'
import SelectField from '../components/ui/SelectField.jsx'
import EchoNote from '../components/ui/EchoNote.jsx'
import LineChart from '../components/performance/LineChart.jsx'
import AttributeBars from '../components/performance/AttributeBars.jsx'
import { useApp } from '../store/AppContext.jsx'
import { useCompanion } from '../components/mascot/companion-context.jsx'
import { performanceStory } from '../components/mascot/scenarios.js'
import { attributeStats, bucketXp, monthChange } from '../lib/stats.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'
import '../styles/pages.css'

const RANGES = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
]

export default function Performance() {
  useDocumentTitle('Performance')
  const { state } = useApp()
  const [range, setRange] = useState('month')

  const points = bucketXp(state.xpLog, range)
  const stats = attributeStats(state)
  const change = monthChange(state.xpLog)
  const withData = stats.filter((s) => s.value !== null).sort((a, b) => b.value - a.value)
  const strengths = withData.filter((s) => s.value >= 75).slice(0, 2)
  const needs = [...withData].reverse().filter((s) => s.value < 75).slice(0, 2)

  // Echo comments on the numbers once per visit: the weakest stat first.
  const companion = useCompanion()
  useEffect(() => {
    const story = performanceStory({
      xp: state.xp,
      strongest: withData[0] || null,
      weakest: withData.length && withData[withData.length - 1].value < 75 ? withData[withData.length - 1] : null,
      change,
    })
    if (story) companion.react(story.pose, story.line, story.tone, story.ms)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <PageHeader title="Performance" subtitle="Track your growth.">
        <SelectField label="Period" value={range} onChange={setRange} options={RANGES} />
      </PageHeader>

      <div className="perf-grid">
        <section className="surface perf-xp">
          <h3>Overall XP</h3>
          <p className="perf-big">{state.xp.toLocaleString()}</p>
          <p className="small muted">
            {change === null ? 'Not enough history to compare with last month.' : `${change >= 0 ? '+' : ''}${change}% from last month`}
          </p>
        </section>

        <section className="surface perf-chart">
          <h3>XP earned, {RANGES.find((r) => r.value === range).label.toLowerCase()}</h3>
          <LineChart points={points} />
        </section>

        <section className="surface perf-attrs">
          <h3>Attribute stats</h3>
          <AttributeBars stats={stats} />
        </section>

        <section className="surface perf-sn">
          <div>
            <h3>Strengths</h3>
            <ul>{strengths.length ? strengths.map((s) => <li key={s.key}>{s.label}</li>) : <li className="muted">None above 75% yet.</li>}</ul>
          </div>
          <div>
            <h3 className="needs">Needs improvement</h3>
            <ul>{needs.length ? needs.map((s) => <li key={s.key} className="needs">{s.label}</li>) : <li className="muted">Nothing below 75%.</li>}</ul>
          </div>
        </section>
      </div>

      <div className="page-note">
        <EchoNote>
          {needs.length ? `${needs[0].label} is your lowest. ${needs[0].source} is where it comes from, so practise that next.` : 'Keep going. The more you study, the more these numbers say.'}
        </EchoNote>
      </div>
    </>
  )
}
