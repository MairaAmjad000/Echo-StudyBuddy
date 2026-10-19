import { useRef } from 'react'
import SelectField from '../ui/SelectField.jsx'
import './whiteboard.css'

const EXAMPLES = [
  { subject: 'Algebra', text: 'Solve 2x + 3 = 11 and explain each step.' },
  { subject: 'Algebra', text: 'Factor x^2 - 5x + 6.' },
  { subject: 'Physics', text: 'A ball is thrown straight up at 20 m/s. How high does it go?' },
  { subject: 'Biology', text: 'Explain photosynthesis in three steps.' },
]

/**
 * Where a lesson starts: a typed question, a photo of one, or both.
 *
 * The photo is compressed in the browser before it is sent, so a phone camera
 * file becomes a few hundred kilobytes instead of several megabytes. Choosing a
 * material is optional and simply gives the model the student's own notes to
 * ground the explanation in.
 */
export default function TeacherStudio({
  materials,
  materialId,
  onMaterial,
  question,
  onQuestion,
  subject,
  onSubject,
  image,
  onPhoto,
  onClearPhoto,
  photoBusy,
  busy,
  error,
  onSubmit,
  compact = false,
}) {
  const fileRef = useRef(null)

  const subjects = [
    { value: '', label: 'Any subject' },
    { value: 'Algebra', label: 'Algebra' },
    { value: 'Geometry', label: 'Geometry' },
    { value: 'Calculus', label: 'Calculus' },
    { value: 'Statistics', label: 'Statistics' },
    { value: 'Physics', label: 'Physics' },
    { value: 'Chemistry', label: 'Chemistry' },
    { value: 'Biology', label: 'Biology' },
    { value: 'Computer Science', label: 'Computer Science' },
    { value: 'History', label: 'History' },
    { value: 'Literature', label: 'Literature' },
    { value: 'Economics', label: 'Economics' },
  ]

  const canSubmit = !busy && !photoBusy && (question.trim().length >= 2 || !!image)

  const pickFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onPhoto(file)
  }

  return (
    <section className={`wb-studio${compact ? ' is-compact' : ''}`} aria-label="Ask for a lesson">
      <div className="wb-studio-copy">
        <h3>What should Echo teach?</h3>
        <p className="muted">
          Paste a problem, type something you are stuck on, or snap a photo of a question. Echo writes the solution
          across the board, one step at a time, and reads it aloud.
        </p>
      </div>

      <label className="field wb-question">
        <span>Your question</span>
        <textarea
          value={question}
          onChange={(e) => onQuestion(e.target.value.slice(0, 4000))}
          rows={compact ? 3 : 4}
          placeholder="For example: Solve 2x + 3 = 11, or explain why the sky is blue."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit) onSubmit()
          }}
        />
      </label>

      {image && (
        <div className="wb-photo">
          <img src={image.dataUrl} alt="The question you photographed" />
          <div className="wb-photo-meta">
            <span className="small muted">Photo attached · {Math.round(image.dataUrl.length / 1024)} KB</span>
            <button type="button" className="btn-text small" onClick={onClearPhoto} disabled={busy}>
              Remove photo
            </button>
          </div>
        </div>
      )}

      <div className="wb-studio-fields">
        <div className="field wb-photo-field">
          <span>Photo of the question</span>
          <button type="button" className="btn btn-quiet wb-photo-btn" onClick={() => fileRef.current?.click()} disabled={busy || photoBusy}>
            {photoBusy ? 'Reading the photo…' : image ? 'Replace photo' : 'Add a photo'}
          </button>
          {/* Hidden rather than .sr-only: the field styles would widen a
              visually-hidden input to the whole row, and its clipped box still
              counts as page overflow. It is opened from the button above. */}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickFile} />
        </div>

        <SelectField label="Subject" value={subject} onChange={onSubject} options={subjects} />

        {materials.length > 0 && (
          <SelectField
            label="Explain from my notes"
            value={materialId}
            onChange={onMaterial}
            options={[{ value: '', label: 'No notes — solve from scratch' }, ...materials.map((m) => ({ value: m.id, label: m.title }))]}
          />
        )}
      </div>

      <div className="wb-examples" aria-label="Example questions">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.text}
            type="button"
            className={`chat-chip${question === ex.text ? ' is-on' : ''}`}
            onClick={() => {
              onQuestion(ex.text)
              onSubject(ex.subject)
            }}
            disabled={busy}
          >
            {ex.text}
          </button>
        ))}
      </div>

      <div className="wb-studio-submit">
        <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={!canSubmit}>
          {busy ? 'Writing the lesson…' : 'Teach me'}
        </button>
        <span className="small muted">
          {question.trim().length >= 2 || image ? 'Ctrl+Enter also starts the lesson.' : 'A question or a photo is enough.'}
        </span>
      </div>

      {busy && (
        <p className="wb-studio-status" role="status">
          Echo is reading the question and planning the board. This usually takes a few seconds.
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <p className="wb-studio-note small muted">
        Lessons are written by echo focusing on main points
      </p>
    </section>
  )
}
