import Button from '../ui/Button.jsx'
import EchoMark from '../brand/EchoMark.jsx'
import { useApp } from '../../store/AppContext.jsx'
import './landing.css'

export default function ClosingCta() {
  const { state } = useApp()
  return (
    <section className="lp-closing">
      <div className="wrap lp-closing-box">
        <EchoMark size={170} />
        <div>
          <h2>Got a chapter to get through tonight?</h2>
          <p className="muted">Upload it and Echo will turn it into notes, flashcards and a quiz.</p>
          <Button to={state.signedIn ? '/app/materials' : '/signup'}>Upload your first notes</Button>
        </div>
      </div>
    </section>
  )
}
