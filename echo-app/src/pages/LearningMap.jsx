import { useEffect, useState } from 'react'
import PageHeader from '../components/ui/PageHeader.jsx'
import SelectField from '../components/ui/SelectField.jsx'
import ProgressBar from '../components/ui/ProgressBar.jsx'
import EchoNote from '../components/ui/EchoNote.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Button from '../components/ui/Button.jsx'
import CourseMap from '../components/map/CourseMap.jsx'
import useMaterialSelection from '../hooks/useMaterialSelection.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'
import { useApp } from '../store/AppContext.jsx'
import { useCompanion } from '../components/mascot/companion-context.jsx'
import { topicDoneStory, topicUndoneStory } from '../components/mascot/scenarios.js'
import { materialProgress } from '../lib/stats.js'
import '../styles/pages.css'

export default function LearningMap() {
  useDocumentTitle('Learning Map')
  const { state, actions } = useApp()
  const companion = useCompanion()
  const { ready, material, setMaterial } = useMaterialSelection()
  const [selected, setSelected] = useState(null)

  const sections = material?.pack.sections || []
  const doneIds = new Set(state.sectionsDone[material?.id] || [])
  const firstOpen = sections.findIndex((s) => !doneIds.has(s.id))
  const allDone = sections.length > 0 && firstOpen === -1
  const bossDone = !!material && state.quizLog.some((q) => q.materialId === material.id && q.boss && q.defeated)

  const stops = [
    ...sections.map((s, i) => ({
      id: s.id,
      title: s.title,
      status: doneIds.has(s.id) ? 'done' : i === firstOpen ? 'current' : 'locked',
    })),
    { id: 'boss', title: 'Boss', boss: true, status: bossDone ? 'done' : allDone ? 'current' : 'locked' },
  ]

  // Start with the current stop selected whenever the course changes.
  useEffect(() => {
    if (!material) return
    const cur = stops.find((s) => s.status === 'current')
    setSelected(cur ? cur.id : stops[0]?.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material?.id])

  if (!material) {
    return (
      <>
        <PageHeader title="Learning Map" subtitle="Your course, laid out in order." />
        <EmptyState title="No course to map yet." action={<Button to="/app/materials">Upload your first notes</Button>}>
          Upload a file and Echo will split it into topics and draw the route.
        </EmptyState>
      </>
    )
  }

  const prog = materialProgress(state, material)
  const section = sections.find((s) => s.id === selected)
  const q = `material=${material.id}`
  const isBoss = selected === 'boss'

  return (
    <>
      <PageHeader title="Learning Map" subtitle="Your course, laid out in order.">
        <SelectField label="Course" value={material.id} onChange={setMaterial} options={ready.map((m) => ({ value: m.id, label: m.title }))} />
      </PageHeader>

      <section className="surface map-panel">
        <div className="map-progress">
          <span>Course progress</span>
          <ProgressBar value={prog.pct} tone="blue" label="Course progress" />
          <strong>{prog.pct}%</strong>
        </div>
        <CourseMap stops={stops} selectedId={selected} onSelect={setSelected} />
      </section>

      <section className="surface stop-detail" aria-live="polite">
        {isBoss ? (
          <>
            <h2>Boss round</h2>
            <p className="muted">Questions from every topic in one fight. It opens once all {sections.length} topics are marked done.</p>
            <div className="btn-row"><Button to={`/app/quiz?${q}&boss=1`}>Fight the boss</Button></div>
          </>
        ) : section ? (
          <>
            <h2>{sections.indexOf(section) + 1}. {section.title}</h2>
            <p className="muted">{section.summary?.[0] || 'Open the notes to see this topic.'}</p>
            <div className="btn-row">
              <Button to={`/app/notes?${q}&section=${section.id}`}>Open notes</Button>
              <Button to={`/app/flashcards?${q}&section=${section.id}`} variant="quiet">Flashcards</Button>
              <Button to={`/app/quiz?${q}&section=${section.id}`} variant="quiet">Quiz this topic</Button>
              <Button to={`/app/teach?${q}&section=${section.id}`} variant="quiet">Teach Echo</Button>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  const wasDone = doneIds.has(section.id)
                  actions.toggleSectionDone(material.id, section.id, section.title)
                  const left = sections.filter((s) => !doneIds.has(s.id) && s.id !== section.id).length
                  const story = wasDone ? topicUndoneStory(section.title) : topicDoneStory({ title: section.title, allDone: left === 0 })
                  companion.react(story.pose, story.line, story.tone, story.ms)
                }}
              >
                {doneIds.has(section.id) ? 'Mark as not done' : 'Mark as done'}
              </button>
            </div>
          </>
        ) : null}
      </section>

      <div className="page-note">
        <EchoNote>Every stop is a topic. Finish one to open the next, and the last stop is the boss.</EchoNote>
      </div>
    </>
  )
}
