import { useEffect, useRef } from 'react'
import './ui.css'

/**
 * The dialog for the actions that cannot be undone. The browser's own
 * confirm() is a grey system box dropped into the middle of a designed page,
 * so the question is asked here instead: what is about to happen, and the two
 * answers side by side. Cancel holds the focus — the safe answer is the easy
 * one — Escape and the backdrop both back out, and the page behind is held
 * still while the question is open.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onCancel])

  return (
    <div className="confirm-backdrop" onClick={onCancel}>
      <div
        className="confirm-card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-text"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-title">{title}</h3>
        <p id="confirm-text">{message}</p>
        <div className="confirm-actions">
          <button type="button" className="btn btn-quiet" ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
