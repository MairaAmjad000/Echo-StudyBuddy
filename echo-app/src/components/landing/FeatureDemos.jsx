import { useState } from 'react'
import FlashDeck from '../flashcards/FlashDeck.jsx'
import BattleView from '../quiz/BattleView.jsx'
import NoteToc from '../notes/NoteToc.jsx'
import NoteSection from '../notes/NoteSection.jsx'
import CourseMap from '../map/CourseMap.jsx'
import AttributeBars from '../performance/AttributeBars.jsx'
import useDeck from '../../hooks/useDeck.js'
import useBattle from '../../hooks/useBattle.js'
import { SAMPLE_PACK } from '../../store/seed.js'

// The landing page demos use the same components as the real app, fed with the built-in sample course.
const pick = (list, ids) => ids.map((id) => list.find((x) => x.id === id))
const DEMO_CARDS = pick(SAMPLE_PACK.cards, ['c17', 'c4', 'c7'])
const DEMO_QUESTIONS = pick(SAMPLE_PACK.questions, ['q1', 'q3', 'q5'])
const DEMO_STOPS = [
  { id: 'a', title: 'Layers and Protocols', status: 'done' },
  { id: 'b', title: 'TCP Connection Setup', status: 'current' },
  { id: 'c', title: 'Transmission Media', status: 'locked' },
  { id: 'd', title: 'Signal and Encoding', status: 'locked' },
  { id: 'e', title: 'Boss', status: 'locked', boss: true },
]
const DEMO_ATTRS = [
  { key: 'knowledge', label: 'Knowledge', value: 72, source: 'Quiz accuracy' },
  { key: 'memory', label: 'Memory', value: 80, source: 'Cards marked easy' },
  { key: 'problem', label: 'Problem solving', value: 65, source: 'Teach Echo scores' },
  { key: 'consistency', label: 'Consistency', value: 91, source: 'Days studied this week' },
  { key: 'speed', label: 'Speed', value: 75, source: 'Quiz answers under 12 seconds' },
]

export function NotesDemo() {
  const sections = SAMPLE_PACK.sections
  const [id, setId] = useState('s3')
  const index = sections.findIndex((s) => s.id === id)
  return (
    <div className="notes-layout">
      <NoteToc title="Data Communication.pdf" sections={sections} activeId={id} onSelect={setId} />
      <div className="note-body">
        <NoteSection section={sections[index]} index={index} />
      </div>
    </div>
  )
}

export function FlashDemo() {
  const deck = useDeck(DEMO_CARDS)
  return (
    <FlashDeck deck={deck}>
      <button type="button" className="btn btn-quiet" onClick={deck.reset}>Go through it again</button>
    </FlashDeck>
  )
}

export function QuizDemo() {
  const battle = useBattle(DEMO_QUESTIONS)
  return (
    <BattleView battle={battle}>
      <button type="button" className="btn btn-quiet" onClick={battle.reset}>Fight again</button>
    </BattleView>
  )
}

export function MapDemo() {
  return <CourseMap stops={DEMO_STOPS} interactive={false} fit />
}

export function PerformanceDemo() {
  return <AttributeBars stats={DEMO_ATTRS} />
}
