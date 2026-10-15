import { useRef, useState } from 'react'
import Echo from '/src/strobi-avatar/Strobi.tsx'
import { ACCEPTED } from '../../lib/extract.js'
import './upload.css'

/** Drag-and-drop area plus a file picker. Calls onFiles with an array of File objects. */
export default function DropZone({ onFiles, busy }) {
  const input = useRef(null)
  const [over, setOver] = useState(false)

  const take = (list) => {
    const files = [...list]
    if (files.length) onFiles(files)
    if (input.current) input.current.value = ''
  }

  return (
    <div
      className={`dropzone surface${over ? ' is-over' : ''}${busy ? ' is-busy' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy) take(e.dataTransfer.files) }}
    >
      <p className="dropzone-title">{over ? 'Drop it — I have got it from here.' : 'Drag and drop your files here'}</p>
      <p className="muted small">PDF, PPTX, DOCX, TXT or MD. Files are read on this device and never uploaded.</p>
      <div className="dropzone-action">
        <Echo size={74} className="dropzone-echo" animation={busy ? 'working' : over ? 'excited' : 'happy'} />
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Reading your file...' : 'Choose files'}
        </button>
      </div>
      <input ref={input} type="file" accept={ACCEPTED} multiple hidden onChange={(e) => take(e.target.files)} aria-label="Choose files to upload" />
    </div>
  )
}
