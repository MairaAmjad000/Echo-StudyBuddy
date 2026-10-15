import Echo from '/src/strobi-avatar/Strobi.tsx'
import './ui.css'

/**
 * Empty state with the live Echo avatar. `animation` picks the pose the
 * companion strikes while the page is empty.
 */
export default function EmptyState({ title, children, action, animation = 'idle' }) {
  return (
    <div className="empty surface">
      <Echo size={84} animation={animation} />
      <div>
        <h3>{title}</h3>
        {children && <p className="muted">{children}</p>}
        {action && <div className="empty-action">{action}</div>}
      </div>
    </div>
  )
}
