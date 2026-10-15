import { useState } from 'react'
import { parseYouTube, MIN_TEXT } from '../../lib/extract.js'
import './upload.css'

/** Paste a YouTube link and its transcript — both are required, because
 *  browsers cannot read a video's captions themselves. */
export default function LinkForm({ onSubmit, busy }) {
  const [url, setUrl] = useState('')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!parseYouTube(url)) {
      setError('That does not look like a YouTube link. Paste the full address from the video page.')
      return
    }
    if (transcript.trim().length < MIN_TEXT) {
      setError('The transcript has to come too — a few paragraphs at least, so there is something to build notes from.')
      return
    }
    setError('')
    const ok = await onSubmit({ url: url.trim(), transcript: transcript.trim() })
    if (ok) {
      setUrl('')
      setTranscript('')
    }
  }

  return (
    <form className="link-form surface" onSubmit={submit}>
      <h3>Paste a YouTube link</h3>
      <label className="field">
        <span>Video link</span>
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." required />
      </label>
      <label className="field">
        <span>Transcript</span>
        <textarea rows={4} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Paste the transcript here to get notes now. In YouTube, open the description and choose Show transcript." required />
      </label>
      <p className="small muted">Websites cannot read a YouTube video directly, so the transcript is required with the link. In YouTube, open the description and choose Show transcript.</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Build notes from transcript
        </button>
      </div>
    </form>
  )
}
