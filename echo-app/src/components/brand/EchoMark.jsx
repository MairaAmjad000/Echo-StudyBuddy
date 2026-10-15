// Echo's brand mark: Echo is the logo. A live avatar instead of a static
// picture — the same character that guides you around the app.
import Echo from '/src/strobi-avatar/Strobi.tsx'

export default function EchoMark({ size = 36, className = '', avatarSize }) {
  const px = avatarSize || size
  return (
    <span
      className={`echomark${className ? ` ${className}` : ''}`}
      style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
    >
      <Echo size={px} className="echomark-avatar" animation="idle" />
    </span>
  )
}
