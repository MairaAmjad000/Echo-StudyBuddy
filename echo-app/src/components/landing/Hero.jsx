import Button from '../ui/Button.jsx'
import MarkedSheet from './MarkedSheet.jsx'
import { useApp } from '../../store/AppContext.jsx'
import './landing.css'

export default function Hero() {
  const { state } = useApp()
  return (
    <section className="wrap hero">
      <div className="hero-copy">
        <h1>Explain it back to Echo and see what you missed.</h1>
        <p className="hero-sub">
          Drop in your slides, PDFs or a lecture link. Echo builds notes, flashcards and quizzes from them, then listens while you explain a
          topic out loud and marks what you got right and what you skipped.
        </p>
        <div className="hero-actions">
          <Button to={state.signedIn ? '/app/materials' : '/signup'}>Upload your first notes</Button>
          {!state.signedIn && <Button to="/login" variant="text">I already have an account</Button>}
        </div>
        <p className="hero-note">Takes slides, PDFs, Word files and YouTube links.</p>
      </div>
      <MarkedSheet />
    </section>
  )
}
