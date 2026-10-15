import { useEffect, useRef, useState } from 'react'
import PageHeader from '../components/ui/PageHeader.jsx'
import SelectField from '../components/ui/SelectField.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import EchoNote from '../components/ui/EchoNote.jsx'
import Button from '../components/ui/Button.jsx'
import FlashDeck from '../components/flashcards/FlashDeck.jsx'
import useDeck from '../hooks/useDeck.js'
import useMaterialSelection from '../hooks/useMaterialSelection.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'
import { useCompanion } from '../components/mascot/companion-context.jsx'
import { firstCardStory, easyStreakStory, allHardStory, deckDoneStory } from '../components/mascot/scenarios.js'
import { useApp } from '../store/AppContext.jsx'
import '../styles/pages.css'

const NO_CARDS = []

export default function Flashcards() {
  useDocumentTitle('Flashcards')
  const { actions } = useApp()
  const { ready, material, section, setMaterial, setSection } = useMaterialSelection()
  const cards = material ? material.pack.cards.filter((c) => !section || c.sectionId === section.id) : NO_CARDS
  const deck = useDeck(cards)
  const saved = useRef(false)
  const [earned, setEarned] = useState(0)
  const companion = useCompanion()

  // Save the session once, when the last card leaves the deck — and give the
  // deck a send-off with the real counts in it.
  useEffect(() => {
    if (deck.done && !saved.current && material) {
      saved.current = true
      actions
        .recordCards({ materialId: material.id, easyIds: deck.easyIds, hardCount: deck.hardCount })
        .then((xp) => {
          setEarned(xp)
          const story = deckDoneStory({ easy: deck.easyIds.length, hard: deck.hardCount, xp })
          companion.react(story.pose, story.line, story.tone, story.ms)
        })
        .catch((e) => actions.toast(e.message, 'error'))
    }
    if (!deck.done) saved.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.done])

  // Opening a deck: say the rule of the game once.
  const toldFirst = useRef(false)
  useEffect(() => {
    toldFirst.current = false
  }, [material?.id, deck.total])
  useEffect(() => {
    if (!material || !deck.total || toldFirst.current) return
    toldFirst.current = true
    const story = firstCardStory()
    companion.react(story.pose, story.line, story.tone, story.ms)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material?.id, deck.total])

  // Five easy cards in a row deserve a nod, and a deck where everything came
  // back deserves a kind word.
  const easyMark = useRef(0)
  useEffect(() => {
    const easy = deck.easyIds.length
    if (easy > 0 && easy % 5 === 0 && easy !== easyMark.current) {
      easyMark.current = easy
      const story = easyStreakStory(deck.left)
      companion.react(story.pose, story.line, story.tone, story.ms)
    }
    if (easy === 0) easyMark.current = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.easyIds.length])

  const toldAllHard = useRef(false)
  useEffect(() => {
    if (deck.total > 0 && !deck.done && deck.hardCount >= deck.total && !toldAllHard.current) {
      toldAllHard.current = true
      const story = allHardStory(deck.total)
      companion.react(story.pose, story.line, story.tone, story.ms)
    }
    if (deck.hardCount === 0) toldAllHard.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.hardCount, deck.done, deck.total])

  if (!material) {
    return (
      <>
        <PageHeader title="AI Flashcards" subtitle="Learn faster with smart flashcards." />
        <EmptyState title="No cards yet." action={<Button to="/app/materials">Upload your first notes</Button>}>
          Upload a file and Echo will write the cards.
        </EmptyState>
      </>
    )
  }

  const topics = [{ value: '', label: 'All topics' }, ...material.pack.sections.map((s) => ({ value: s.id, label: s.title }))]

  return (
    <>
      <PageHeader title="AI Flashcards" subtitle="Flip the card, then mark it easy or hard. Hard cards come back.">
        <SelectField label="Material" value={material.id} onChange={setMaterial} options={ready.map((m) => ({ value: m.id, label: m.title }))} />
        <SelectField label="Topic" value={section?.id || ''} onChange={setSection} options={topics} />
      </PageHeader>

      <div className="side-by-side">
        <div className="narrow">
          <FlashDeck deck={deck}>
            <button type="button" className="btn btn-primary" onClick={() => { deck.reset(); setEarned(0) }}>Study again</button>
            <Button to={`/app/quiz?material=${material.id}${section ? `&section=${section.id}` : ''}`} variant="quiet">Take the quiz</Button>
            {earned > 0 && <span className="small muted">+{earned} XP</span>}
          </FlashDeck>
        </div>
      </div>

      <div className="page-note">
        <EchoNote>Say the answer out loud before you flip the card. If you hesitated, mark it hard.</EchoNote>
      </div>
    </>
  )
}
