import { useState } from 'react'
import { timeAgo, typeLabel } from '../../lib/format.js'
import Button from '../ui/Button.jsx'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'
import './upload.css'

function MaterialRow({ material, onRemove, onTranscript, busy }) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [confirming, setConfirming] = useState(false)
  const ready = material.status === 'ready'
  const pack = material.pack

  return (
    <li className="material">
      <span className="material-type" aria-hidden="true">{typeLabel(material.type)}</span>
      <div className="material-main">
        <p className="material-title">{material.title}</p>
        <p className="small muted">
          Added {timeAgo(material.addedAt)}.{' '}
          {ready ? `${pack.sections.length} topics, ${pack.cards.length} cards, ${pack.questions.length} questions.` : 'Needs a transcript before notes can be built.'}
        </p>
        {adding && (
          <form
            className="transcript-form"
            onSubmit={async (e) => {
              e.preventDefault()
              if (await onTranscript(material, text)) setAdding(false)
            }}
          >
            <label className="field">
              <span>Transcript</span>
              <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} required />
            </label>
            <div className="btn-row">
              <button type="submit" className="btn btn-primary" disabled={busy}>Build notes</button>
              <button type="button" className="btn btn-quiet" onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
      <div className="material-actions">
        {ready ? (
          <Button to={`/app/notes?material=${material.id}`} variant="quiet">Open notes</Button>
        ) : (
          !adding && <button type="button" className="btn btn-quiet" onClick={() => setAdding(true)}>Add transcript</button>
        )}
        <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
          Remove
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Remove this material?"
          message={`“${material.title}” and its progress are removed. This cannot be undone.`}
          confirmLabel="Remove it"
          danger
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            onRemove(material)
          }}
        />
      )}
    </li>
  )
}

export default function MaterialList({ materials, ...rest }) {
  if (!materials.length) return <p className="muted">No materials yet. Upload a file above to get started.</p>
  return (
    <ul className="materials">
      {materials.map((m) => <MaterialRow key={m.id} material={m} {...rest} />)}
    </ul>
  )
}
