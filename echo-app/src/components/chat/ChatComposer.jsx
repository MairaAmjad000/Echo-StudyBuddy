import { useEffect, useRef } from 'react'
import Button from '../ui/Button.jsx'
import './chat.css'

/**
 * The question box: one compact rounded field, the text on the left and the
 * Send button on the right. The text area starts one line tall and grows with
 * the question so the button is never pushed out of the box. Enter sends,
 * Shift+Enter starts a new line — that stays available to screen readers
 * without a line of small print under the box.
 */
export default function ChatComposer({ value, onChange, onSend, busy, disabled, hint }) {
  const field = useRef(null)

  // Auto-grow: reset first, so the box also shrinks back after sending.
  useEffect(() => {
    const el = field.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [value])

  const submit = (e) => {
    e.preventDefault()
    onSend()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <form className="chat-compose" onSubmit={submit}>
      <label className="sr-only" htmlFor="chat-question">
        Your question for Echo
      </label>
      <div className="chat-input">
        <textarea
          ref={field}
          id="chat-question"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          rows={1}
          maxLength={2000}
          placeholder="Ask about this material, or ask Echo to quiz you..."
          aria-describedby="chat-hint"
        />
        <span className="sr-only" id="chat-hint">
          {hint}
        </span>
        <Button type="submit" className="chat-send" disabled={disabled || busy || !value.trim()}>
          {busy ? 'Thinking...' : 'Send'}
        </Button>
      </div>
    </form>
  )
}
