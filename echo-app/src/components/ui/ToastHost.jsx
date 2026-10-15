import { useApp } from '../../store/AppContext.jsx'
import './ui.css'

export default function ToastHost() {
  const { toasts, actions } = useApp()
  if (!toasts.length) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          <span>{t.message}</span>
          <button type="button" onClick={() => actions.dismissToast(t.id)} aria-label="Dismiss message">
            Close
          </button>
        </div>
      ))}
    </div>
  )
}
