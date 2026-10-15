import { useEffect } from 'react'
import PageHeader from '../components/ui/PageHeader.jsx'
import SelectField from '../components/ui/SelectField.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Button from '../components/ui/Button.jsx'
import NoteToc from '../components/notes/NoteToc.jsx'
import NoteSection from '../components/notes/NoteSection.jsx'
import useMaterialSelection from '../hooks/useMaterialSelection.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'
import { useApp } from '../store/AppContext.jsx'
import { useCompanion } from '../components/mascot/companion-context.jsx'
import { topicDoneStory, topicUndoneStory } from '../components/mascot/scenarios.js'
import '../styles/pages.css'

export default function SmartNotes() {
  useDocumentTitle('Smart Notes')
  const { state, actions } = useApp()
  const companion = useCompanion()
  const { ready, material, section, setMaterial, setSection } = useMaterialSelection()
  const sectionId = section?.id

  // Jump to the chosen topic and remember it as the last one studied.
  useEffect(() => {
    if (!material || !sectionId) return
    document.getElementById(`section-${sectionId}`)?.scrollIntoView({ block: 'start' })
    actions.touch(material.id, sectionId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material?.id, sectionId])

  if (!material) {
    return (
      <>
        <PageHeader title="Smart Notes" subtitle="Revision notes written from your files." />
        <EmptyState title="No notes yet." action={<Button to="/app/materials">Upload your first notes</Button>}>
          Upload a file and its notes will show up here.
        </EmptyState>
      </>
    )
  }

  const done = state.sectionsDone[material.id] || []
  const q = `material=${material.id}`

  return (
    <>
      <PageHeader title="Smart Notes" subtitle="Revision notes written from your files.">
        <SelectField label="Material" value={material.id} onChange={setMaterial} options={ready.map((m) => ({ value: m.id, label: m.title }))} />
        <Button to={`/app/flashcards?${q}`} variant="quiet">Generate flashcards</Button>
        <Button to={`/app/quiz?${q}`}>Start quiz</Button>
      </PageHeader>

      <div className="notes-layout">
        <NoteToc title={material.title} sections={material.pack.sections} activeId={sectionId} doneIds={done} onSelect={setSection} />
        <div className="note-body">
          <div className="note-print-head">
            <h1>{material.title}</h1>
            <p>{material.pack.sections.length} sections. Revision notes written by Echo.</p>
          </div>
          {material.pack.sections.map((s, i) => (
            <NoteSection
              key={s.id}
              section={s}
              index={i}
              done={done.includes(s.id)}
              onToggleDone={() => {
                const wasDone = done.includes(s.id)
                actions.toggleSectionDone(material.id, s.id, s.title)
                const left = material.pack.sections.filter((x) => !done.includes(x.id) && x.id !== s.id).length
                const story = wasDone ? topicUndoneStory(s.title) : topicDoneStory({ title: s.title, allDone: left === 0 })
                companion.react(story.pose, story.line, story.tone, story.ms)
              }}
              actions={
                <>
                  <Button to={`/app/flashcards?${q}&section=${s.id}`} variant="quiet">Flashcards</Button>
                  <Button to={`/app/teach?${q}&section=${s.id}`} variant="quiet">Teach Echo</Button>
                </>
              }
            />
          ))}
        </div>
      </div>
    </>
  )
}
