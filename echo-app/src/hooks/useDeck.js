import { useEffect, useMemo, useReducer } from 'react'

const init = (cards) => ({ queue: cards.map((c) => c.id), showing: false, easy: [], hard: 0, total: cards.length })

function reducer(s, a) {
  switch (a.type) {
    case 'flip':
      return s.queue.length ? { ...s, showing: !s.showing } : s
    case 'hard': {
      if (!s.queue.length) return s
      const [first, ...rest] = s.queue
      return { ...s, queue: [...rest, first], showing: false, hard: s.hard + 1 } // goes to the back of the deck
    }
    case 'easy': {
      if (!s.queue.length) return s
      const [first, ...rest] = s.queue
      return { ...s, queue: rest, showing: false, easy: [...s.easy, first] }
    }
    case 'reset':
      return init(a.cards)
    default:
      return s
  }
}

/** Flashcard session: hard cards return to the back of the deck, easy cards leave it. */
export default function useDeck(cards) {
  const [s, dispatch] = useReducer(reducer, cards, init)
  const key = cards.map((c) => c.id).join('|')
  useEffect(() => {
    dispatch({ type: 'reset', cards })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  return {
    current: s.queue.length ? byId.get(s.queue[0]) || null : null,
    showing: s.showing,
    total: s.total,
    left: s.queue.length,
    easyIds: s.easy,
    hardCount: s.hard,
    done: s.total > 0 && s.queue.length === 0,
    flip: () => dispatch({ type: 'flip' }),
    markHard: () => dispatch({ type: 'hard' }),
    markEasy: () => dispatch({ type: 'easy' }),
    reset: () => dispatch({ type: 'reset', cards }),
  }
}
