import './ui.css'

/** A short line from Echo, written like a margin note. */
export default function EchoNote({ children }) {
  return (
    <aside className="echo-note">
      <img className="echo-note-mark" src="/echo.png" alt="" width="34" height="34" />
      <p>{children}</p>
    </aside>
  )
}
