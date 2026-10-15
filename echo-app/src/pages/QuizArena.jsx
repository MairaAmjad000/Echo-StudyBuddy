import { useEffect, useMemo, useRef, useState } from 'react'
import PageHeader from '../components/ui/PageHeader.jsx'
import SelectField from '../components/ui/SelectField.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import EchoNote from '../components/ui/EchoNote.jsx'
import Button from '../components/ui/Button.jsx'
import BattleView from '../components/quiz/BattleView.jsx'
import useBattle from '../hooks/useBattle.js'
import useMaterialSelection from '../hooks/useMaterialSelection.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'
import { useApp } from '../store/AppContext.jsx'
import { useCompanion } from '../components/mascot/companion-context.jsx'
import { bossIntroStory } from '../components/mascot/scenarios.js'
import { shuffle } from '../lib/format.js'
import '../styles/pages.css'

const MONSTERS = ['Packet Fiend', 'Syntax Specter', 'Bug Beast', 'Latency Imp', 'Overflow Ogre', 'Null Pointer']
const hash = (s) => [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7)

// Questions come in rounds: a deck can hold hundreds, and every one of them is
// meant to be asked, so finishing a round offers the next slice of the pool
// instead of ending the session with most of the material unseen.
const ROUND_SIZE = 25

export default function QuizArena() {
  useDocumentTitle('Quiz Arena')
  const { actions } = useApp()
  const companion = useCompanion()
  const { ready, material, section, params, update, setMaterial } = useMaterialSelection()
  const boss = params.get('boss') === '1'
  const [deal, setDeal] = useState(0)
  const [played, setPlayed] = useState(0)

  // One shuffled deal of every question that fits the chosen scope; the rounds
  // below walk through it.
  const questions = useMemo(() => {
    if (!material) return []
    const pool = material.pack.questions.filter((q) => boss || !section || q.sectionId === section.id)
    return shuffle(pool)
    // `deal` re-deals the questions for "Fight again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material?.id, section?.id, boss, deal])

  const roundQuestions = useMemo(() => questions.slice(played, played + ROUND_SIZE), [questions, played])
  const remaining = Math.max(0, questions.length - (played + roundQuestions.length))

  // A new deck, topic or material starts from the top again.
  useEffect(() => {
    setPlayed(0)
  }, [material?.id, section?.id, boss, deal])

  const battle = useBattle(roundQuestions)
  const saved = useRef(false)
  const [earned, setEarned] = useState(0)

  // The boss gets an introduction before the first question lands.
  useEffect(() => {
    if (!boss || !material) return
    const story = bossIntroStory('Firewall Titan', questions.length || 15)
    companion.react(story.pose, story.line, story.tone, story.ms)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss, material?.id])

  useEffect(() => {
    if (battle.over && !saved.current && material) {
      saved.current = true
      actions
        .recordQuiz({
          materialId: material.id,
          correct: battle.correctCount,
          total: battle.answered,
          defeated: battle.defeated,
          fast: battle.fastCount,
          boss,
        })
        .then(setEarned)
        .catch((e) => actions.toast(e.message, 'error'))
    }
    if (!battle.over) saved.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle.over])

  if (!material) {
    return (
      <>
        <PageHeader title="Quiz Arena" subtitle="Defeat the monsters of ignorance." />
        <EmptyState title="No questions yet." action={<Button to="/app/materials">Upload your first notes</Button>}>
          Upload a file and Echo will write the questions.
        </EmptyState>
      </>
    )
  }

  const monster = boss ? 'Firewall Titan' : MONSTERS[hash(material.id) % MONSTERS.length]
  const topics = [{ value: '', label: 'All topics' }, ...material.pack.sections.map((s) => ({ value: s.id, label: s.title }))]
  const fightAgain = () => { setEarned(0); setPlayed(0); setDeal((d) => d + 1) }
  const nextRound = () => { setEarned(0); setPlayed((p) => p + ROUND_SIZE) }

  return (
    <>
      <PageHeader title={boss ? 'Boss round' : 'Quiz Arena'} subtitle={boss ? 'Questions from every topic. Beat the boss to clear the map.' : 'Defeat the monsters of ignorance.'}>
        <SelectField label="Material" value={material.id} onChange={(id) => setMaterial(id, { boss: null })} options={ready.map((m) => ({ value: m.id, label: m.title }))} />
        <SelectField label="Topic" value={boss ? '' : section?.id || ''} onChange={(id) => update({ section: id, boss: null })} options={topics} />
      </PageHeader>

      {questions.length === 0 ? (
        <EmptyState title="This topic has no questions.">Pick another topic, or study the notes first.</EmptyState>
      ) : (
        <div className="side-by-side">
          <div className="narrow">
            <p className="small muted">
              Round {Math.floor(played / ROUND_SIZE) + 1} of {Math.max(1, Math.ceil(questions.length / ROUND_SIZE))}
              {' · '}
              {questions.length} questions in this deck
            </p>
            <BattleView
              battle={battle}
              monsterName={monster}
              resultNote={earned > 0 ? `+${earned} XP` : ''}
              offset={played}
              poolSize={questions.length}
            >
              {remaining > 0 ? (
                <button type="button" className="btn btn-primary" onClick={nextRound}>
                  Next {Math.min(ROUND_SIZE, remaining)} questions
                </button>
              ) : (
                <button type="button" className="btn btn-quiet" onClick={fightAgain}>Fight again</button>
              )}
              <Button to={`/app/notes?material=${material.id}`} variant="quiet">Review the notes</Button>
              {boss && battle.defeated && <Button to={`/app/map?material=${material.id}`} variant="quiet">Back to the map</Button>}
            </BattleView>
          </div>

        </div>
      )}

      <div className="page-note">
        <EchoNote>Think smart, you can do it. Read all four options before you pick.</EchoNote>
      </div>
    </>
  )
}
