import { useEffect } from 'react'
import './flashcards.css'
import { useCompanion } from '../mascot/companion-context.jsx'

/**
 * The flashcard view. It only draws a deck made by useDeck, so the landing page
 * demo and the real Flashcards page share exactly the same card.
 */
export default function FlashDeck({ deck, children }) {
  const companion = useCompanion()
  const flipped = deck.showing

  // React to flips and marks so Echo cheers or nods along with the session.
  useEffect(() => {
    if (flipped) companion.react('curious', 'Did you say it before flipping?', 'info', 3000)
  }, [flipped]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      if (e.key.toLowerCase() === 'h' && deck.showing) deck.markHard()
      if (e.key.toLowerCase() === 'e' && deck.showing) deck.markEasy()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deck])

  if (deck.total === 0) return <p className="muted">There are no cards in this deck yet.</p>

  if (deck.done) {
    return (
      <div className="deck-done surface">
        <h3>Deck finished.</h3>
        <p className="muted">
          {deck.easyIds.length} cards marked easy{deck.hardCount ? `, and ${deck.hardCount} hard answers along the way` : ''}.
        </p>
        <div className="btn-row">{children}</div>
      </div>
    )
  }

  const card = deck.current
  if (!card) return null
  const position = Math.min(deck.total, deck.easyIds.length + 1)

  return (
    <div className="deck">
      <div className="deck-meta">
        <span>Card {position} / {deck.total}</span>
        <span>{deck.left} left</span>
      </div>
      <button type="button" className={`card${deck.showing ? ' is-answer' : ''}`} onClick={deck.flip} aria-live="polite">
        <span className="card-face">{deck.showing ? card.a : card.q}</span>
        <span className="card-hint">{deck.showing ? 'Select the card to see the question again' : 'Select the card to see the answer'}</span>
      </button>
      {deck.showing && (
        <div className="deck-actions">
          <button type="button" className="btn btn-quiet" onClick={deck.markHard}>Hard, show it again</button>
          <button type="button" className="btn btn-quiet" onClick={deck.markEasy}>Easy</button>
          <span className="small muted deck-keys">Keys: H for hard, E for easy</span>
        </div>
      )}
    </div>
  )
}
