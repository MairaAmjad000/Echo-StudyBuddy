import { useEffect, useRef } from 'react'
import EchoMark from '../brand/EchoMark.jsx'
import Fiend from '../brand/Fiend.jsx'
import { useCompanion } from '../mascot/companion-context.jsx'
import { battleHitStory, battleOverStory } from '../mascot/scenarios.js'
import './quiz.css'

const LETTERS = 'ABCDEFGH'

function Fighter({ icon, name, hp, tone }) {
  return (
    <div className="fighter">
      {icon}
      <div className="fighter-who">
        {name}
        <span className={`hp ${tone}`} role="progressbar" aria-valuenow={hp} aria-valuemin={0} aria-valuemax={100} aria-label={`${name} health`}>
          <i style={{ width: `${hp}%` }} />
        </span>
        <small>{hp} / 100</small>
      </div>
    </div>
  )
}

/**
 * The Quiz Arena view. It draws a fight made by useBattle. `children` is shown on the result
 * screen (buttons, XP earned) so each page decides what happens next.
 */
export default function BattleView({ battle, monsterName = 'Packet Fiend', children, resultNote, offset = 0, poolSize = 0 }) {
  const { question } = battle
  const companion = useCompanion()
  const answered = battle.results.length
  const lastResult = answered ? battle.results[answered - 1] : null
  // A long deck is played in rounds, so the count can follow the whole pool
  // rather than restarting at 1 every round.
  const shown = offset + battle.index + 1
  const total = poolSize || battle.total

  // React to the latest answer, and to the end of the fight. Each line is
  // drawn from a rotating set so a long fight never repeats itself.
  useEffect(() => {
    if (!lastResult) return
    const s = battleHitStory(lastResult.correct)
    companion.react(s.pose, s.line, s.tone, s.ms)
  }, [answered]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!battle.over) return
    const s = battleOverStory({ defeated: battle.defeated, killed: battle.echo === 0, monsterName })
    companion.react(s.pose, s.line, s.tone, s.ms)
  }, [battle.over]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="arena">
      <div className="fighters">
        <Fighter icon={<EchoMark size={52} />} name="Echo" hp={battle.echo} tone="hp-echo" />
        <Fighter icon={<Fiend size={52} />} name={monsterName} hp={battle.monster} tone="hp-foe" />
      </div>

      {battle.over ? (
        <div className="arena-result">
          <p className="arena-result-title">
            {battle.defeated
              ? `${monsterName} is defeated.`
              : battle.echo === 0
                ? `${monsterName} wins this round.`
                : `${monsterName} survives with ${battle.monster} HP.`}
          </p>
          <p className="arena-result-sub">
            You answered {battle.correctCount} of {battle.answered} correctly. Echo finished with {battle.echo} HP.
          </p>
          {resultNote && <p className="arena-result-sub">{resultNote}</p>}
          <div className="btn-row">{children}</div>
        </div>
      ) : (
        question && (
          <div>
            <p className="arena-count">Question {shown} / {total}</p>
            <h4 className="arena-q">{question.q}</h4>
            <div className="arena-opts">
              {question.options.map((text, k) => {
                const answered = battle.phase === 'answered'
                const right = answered && k === question.answer
                const wrong = answered && k === battle.picked && k !== question.answer
                return (
                  <button
                    key={k}
                    type="button"
                    className={`opt${right ? ' is-right' : ''}${wrong ? ' is-wrong' : ''}`}
                    disabled={answered}
                    onClick={() => battle.pick(k)}
                  >
                    <span className="opt-letter">{LETTERS[k]}</span>
                    <span className="opt-text">{text}</span>
                    <span className="opt-tag">{right ? (k === battle.picked ? 'Correct' : 'Answer') : wrong ? 'Not this one' : ''}</span>
                  </button>
                )
              })}
            </div>
            <p className="arena-fb" aria-live="polite">
              {battle.phase === 'answered' &&
                `${battle.picked === question.answer ? 'Direct hit. ' : `${monsterName} hits back. `}${question.why}`}
            </p>
            {battle.phase === 'answered' && (
              <button type="button" className="btn btn-quiet" onClick={battle.next} autoFocus>
                {battle.index >= battle.total - 1 || battle.echo === 0 ? 'See result' : 'Next question'}
              </button>
            )}
          </div>
        )
      )}
    </div>
  )
}
