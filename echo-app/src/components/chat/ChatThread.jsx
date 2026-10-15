import { useEffect, useRef } from 'react'
import EchoMark from '../brand/EchoMark.jsx'
import Echo from '/src/strobi-avatar/Strobi.tsx'
import './chat.css'

/**
 * The conversation so far. Echo's turns wear the brand mark, the student's sit
 * on the right. While an answer is on its way the thread shows three dots.
 * Before the first message, Strobi waits in the centre with a greeting.
 */
export default function ChatThread({ messages, busy, suggestions = [], onSuggest, error, greeting }) {
  const logRef = useRef(null)

  // Follow the newest turn, however tall the thread gets.
  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [messages.length, busy, error])

  return (
    <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-label="Conversation with Echo">
      {messages.length === 0 && !busy && (
        <div className="chat-start">
          <div className="chat-welcome">
            <p className="chat-welcome-note">
              {greeting || 'Ask me anything about this material. I answer from your own notes.'}
            </p>
            <Echo size={128} animation="listening" className="chat-welcome-echo" />
          </div>
          {suggestions.length > 0 && (
            <div className="chat-chips">
              {suggestions.map((s) => (
                <button key={s} type="button" className="chat-chip" onClick={() => onSuggest(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {messages.map((m, i) => (
        <div key={`${m.role}-${i}`} className={`chat-turn chat-turn-${m.role}`}>
          {m.role === 'echo' && <EchoMark size={38} />}
          <p className="chat-bubble">{m.content}</p>
        </div>
      ))}

      {busy && (
        <div className="chat-turn chat-turn-echo">
          <EchoMark size={38} />
          <span className="chat-typing" aria-label="Echo is thinking">
            <i /><i /><i />
          </span>
        </div>
      )}

      {error && (
        <p className="field-error" role="alert">{error}</p>
      )}
    </div>
  )
}
