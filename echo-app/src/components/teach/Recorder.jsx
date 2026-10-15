import { mmss } from '../../lib/format.js'
import Waveform from './Waveform.jsx'
import './teach.css'

/** Microphone panel: waveform, timer and a start / stop button. */
export default function Recorder({ topic, speech, onStart, onStop }) {
  const { supported, listening, seconds, analyser, error } = speech
  return (
    <section className="recorder surface" aria-label="Voice recorder">
      <p className="recorder-topic">Topic: <strong>{topic}</strong></p>
      <Waveform analyser={analyser} active={listening} />
      <div className="recorder-row">
        <span className="recorder-time" aria-live="off">{mmss(seconds)}</span>
        <span className="recorder-status">{listening ? 'Listening...' : supported ? 'Ready when you are' : 'Voice is not available here'}</span>
        {listening ? (
          <button type="button" className="rec-btn is-stop" onClick={onStop} aria-label="Stop recording">
            <span aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="rec-btn" onClick={onStart} disabled={!supported} aria-label="Start recording">
            <span aria-hidden="true" />
          </button>
        )}
      </div>
      {!supported && (
        <p className="field-error">Speech recognition is not supported in this browser (Chrome, Edge and Safari work). Type your explanation below instead.</p>
      )}
      {error && <p className="field-error" role="alert">{error}</p>}
    </section>
  )
}
