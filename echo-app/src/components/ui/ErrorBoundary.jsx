import { Component } from 'react'
import Echo from '/src/strobi-avatar/Strobi.tsx'
import './ui.css'

export default class ErrorBoundary extends Component {
  state = { error: null, stack: '', componentStack: '' }

  static getDerivedStateFromError(error) {
    return { error }
  }

  // The one-line message the UI shows ("destroy is not a function") is not enough to
  // locate a bug, so also record where it was thrown from.
  componentDidCatch(error, info) {
    const stack = error?.stack || ''
    const componentStack = info?.componentStack || ''
    this.setState({ stack, componentStack })
    console.error('[Echo] Uncaught render/effect error', error, '\nComponent stack:', componentStack)
    try {
      localStorage.setItem('echo.lastError', JSON.stringify({ message: String(error?.message || error), stack, componentStack, at: new Date().toISOString() }))
    } catch { /* storage full */ }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="wrap empty surface" style={{ marginTop: 64 }}>
        <Echo size={84} animation="confused" />
        <div>
          <h3>Something broke on this page.</h3>
          <p className="muted">{String(this.state.error.message || this.state.error)}</p>
          {(this.state.stack || this.state.componentStack) && (
            <details className="small muted error-details">
              <summary>Technical details</summary>
              {this.state.stack && <pre>{this.state.stack}</pre>}
              {this.state.componentStack && <pre>{this.state.componentStack}</pre>}
            </details>
          )}
          <div className="empty-action">
            <button className="btn btn-primary" type="button" onClick={() => window.location.assign('/')}>
              Back to the home page
            </button>
          </div>
        </div>
      </div>
    )
  }
}
