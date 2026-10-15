import { useEffect, useReducer, useRef } from 'react'
import { FAST_MS } from '../lib/xp.js'

const init = () => ({ index: 0, monster: 100, echo: 100, picked: null, results: [], phase: 'question' })

function reducer(s, a) {
  switch (a.type) {
    case 'pick': {
      if (s.phase !== 'question') return s
      return {
        ...s,
        picked: a.k,
        phase: 'answered',
        monster: a.correct ? Math.max(0, s.monster - Math.ceil(100 / a.total)) : s.monster, // a right answer hits the monster
        echo: a.correct ? s.echo : Math.max(0, s.echo - 20), // a wrong answer hits Echo
        results: [...s.results, { correct: a.correct, ms: a.ms }],
      }
    }
    case 'next':
      if (s.phase !== 'answered') return s
      if (s.index >= a.total - 1 || s.echo === 0) return { ...s, phase: 'over' }
      return { ...s, index: s.index + 1, picked: null, phase: 'question' }
    case 'reset':
      return init()
    default:
      return s
  }
}

/** One Quiz Arena fight. Right answers hit the monster, wrong answers hit Echo. */
export default function useBattle(questions) {
  const [s, dispatch] = useReducer(reducer, undefined, init)
  const total = questions.length
  const key = questions.map((q) => q.id).join('|')
  const shownAt = useRef(Date.now())

  useEffect(() => {
    dispatch({ type: 'reset' })
  }, [key])
  useEffect(() => {
    shownAt.current = Date.now()
  }, [s.index, key])

  const question = questions[s.index] || null
  return {
    ...s,
    total,
    question,
    correctCount: s.results.filter((r) => r.correct).length,
    fastCount: s.results.filter((r) => r.ms <= FAST_MS).length,
    answered: s.results.length,
    over: s.phase === 'over',
    defeated: s.monster === 0,
    pick(k) {
      if (!question) return
      dispatch({ type: 'pick', k, correct: k === question.answer, ms: Date.now() - shownAt.current, total })
    },
    next: () => dispatch({ type: 'next', total }),
    reset: () => dispatch({ type: 'reset' }),
  }
}
