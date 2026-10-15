import Echo from '/src/strobi-avatar/Strobi.tsx'
import Button from '../components/ui/Button.jsx'
import useDocumentTitle from '../hooks/useDocumentTitle.js'

export default function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <div className="wrap empty surface" style={{ marginTop: 64 }}>
      <Echo size={96} animation="confused" />
      <div>
        <h1 style={{ fontSize: '2rem' }}>This page does not exist.</h1>
        <p className="muted">The link may be old or mistyped.</p>
        <div className="empty-action"><Button to="/">Back to the home page</Button></div>
      </div>
    </div>
  )
}
