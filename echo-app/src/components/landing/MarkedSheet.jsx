import EchoMark from '../brand/EchoMark.jsx'
import './landing.css'

// A fixed picture of a bar waveform, so the sheet looks the same on every load.
const BARS = Array.from({ length: 34 }, (_, i) => 4 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.55)) * 19)

/**
 * The hero: a Teach Echo answer marked up like a corrected exam sheet. This is the one
 * animated moment on the page. The pen marks draw in once, in order, on load.
 */
export default function MarkedSheet() {
  return (
    <figure className="sheet">
      <div className="sheet-bar">
        <span>Teach Echo &nbsp;/&nbsp; <b>Topic: TCP handshake</b></span>
        <span className="wave">
          <svg width="170" height="26" viewBox="0 0 170 26" aria-hidden="true">
            {BARS.map((h, i) => <rect key={i} x={i * 5} y={(26 - h) / 2} width="3" height={h} rx="1.5" />)}
          </svg>
          0:45
        </span>
      </div>

      <div className="sheet-body">
        <p className="explain">
          First, the client sends a <span className="mark" style={{ '--d': '.7s' }}>SYN packet</span> to the server.<sup className="ref">a</sup>{' '}
          Then the server replies with <span className="mark" style={{ '--d': '1.05s' }}>SYN-ACK</span>. Finally the client sends{' '}
          <span className="mark" style={{ '--d': '1.4s' }}>ACK</span> and{' '}
          <span className="mark miss" style={{ '--d': '2s' }}>the connection is established</span>.<sup className="ref b">b</sup>
        </p>
        <aside className="margin" aria-label="Echo's feedback">
          <div className="m-head"><EchoMark size={30} /><span>Echo's marks</span></div>
          <p className="note note-a" style={{ '--d': '1.7s' }}><b>a</b> Right steps, in the right order.</p>
          <p className="note note-b" style={{ '--d': '2.5s' }}>
            <b>b</b> You left out sequence numbers. Each side picks one and sends it with these packets, which is how a lost packet gets noticed.
          </p>
          <div className="score" style={{ '--d': '3.1s' }}>
            <div className="ring">
              <svg viewBox="0 0 92 58" aria-hidden="true"><ellipse pathLength="1" cx="46" cy="29" rx="42" ry="24" /></svg>
              <span className="num">85%</span>
            </div>
            <em>Good job</em>
          </div>
        </aside>
      </div>
      <figcaption>A sample Teach Echo session. The answer is typed out here, in the app you say it out loud.</figcaption>
    </figure>
  )
}
