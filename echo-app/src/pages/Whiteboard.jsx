import { useCallback, useEffect, useRef, useState } from 'react'
import PageHeader from '../components/ui/PageHeader.jsx'
import EchoNote from '../components/ui/EchoNote.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import BoardView from '../components/whiteboard/Whiteboard.jsx'
import TeacherStudio from '../components/whiteboard/TeacherStudio.jsx'
import LessonRail from '../components/whiteboard/LessonRail.jsx'
import useNarration from '../hooks/useNarration.js'
import useMediaQuery from '../hooks/useMediaQuery.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'
import { useApp } from '../store/AppContext.jsx'
import { preparePhoto } from '../lib/image.js'
import { clamp } from '../lib/format.js'
import '../styles/pages.css'
import '../components/whiteboard/whiteboard.css'

/** Roughly how long a line takes to read aloud, so sound-off playback still paces itself. */
const readingMs = (text) => clamp(1800, (String(text || '').trim().split(/\s+/).filter(Boolean).length / 3.2) * 1000 + 1200, 20_000)

/**
 * Whiteboard Teacher.
 *
 * The student brings a question — typed or photographed — and Echo teaches it
 * at the board: each step is written on a white sheet, the board reads the step
 * aloud in the same free Edge voice as Podcast with Echo, and Back / Next / Play
 * walk the lesson at the student's pace.
 *
 * The lesson comes from the same Gemini key as the rest of the app. The photo
 * goes to the model as an image (vision), so there is no OCR service to sign up
 * for; the browser compresses it first. Lessons are stored on the server, which
 * is why reopening one from the rail is instant and costs no AI call.
 */
export default function Whiteboard() {
  useDocumentTitle('Whiteboard Teacher')
  const { state, actions } = useApp()
  const wideEnough = useMediaQuery('(min-width: 1200px)')

  const [lessons, setLessons] = useState([])
  const [lesson, setLesson] = useState(null)
  // The podcast's voice is recorded per step on the server; the hook needs the
  // lesson id so it can release the old blobs when the student opens another.
  const narration = useNarration(lesson?.id)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  // Bumped when Play is pressed, so the narration effect re-reads the step
  // that is already on the board. Step changes speak on their own.
  const [speakNonce, setSpeakNonce] = useState(0)

  const [studioOpen, setStudioOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [subject, setSubject] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [image, setImage] = useState(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [showRail, setShowRail] = useState(wideEnough)
  const railChosen = useRef(false)
  const picked = useRef(false)

  // The rail is a second column where there is room; on narrower screens it
  // stacks above the board and can be folded away with the History button.
  useEffect(() => {
    if (!railChosen.current) setShowRail(wideEnough)
  }, [wideEnough])

  const playingRef = useRef(playing)
  playingRef.current = playing
  const stepRef = useRef(step)
  stepRef.current = step

  const refresh = useCallback(async () => {
    try {
      const list = await actions.listWhiteboardLessons()
      setLessons(list)
      setLoadError('')
      if (!picked.current && list.length) {
        picked.current = true
        try {
          setLesson(await actions.loadWhiteboardLesson(list[0].id))
        } catch (e) {
          setLoadError(e.message)
          setStudioOpen(true)
        }
      } else if (!list.length) {
        setStudioOpen(true)
      }
      return list
    } catch (e) {
      setLoadError(e.message)
      setStudioOpen(true)
      return []
    } finally {
      setLoading(false)
    }
  }, [actions])

  useEffect(() => {
    refresh()
  }, [refresh])

  /**
   * The narration clock for the step on the board. It plays the recorded step
   * (in the podcast's voice) and, while the lesson is playing, the end of the
   * recording moves to the next step. With sound off, Play still advances on a
   * reading-time estimate, so the lesson works silently too.
   *
   * A refused autoplay or a rate-limited voice stops playback and shows the
   * reason; pressing Play is a user gesture, and retries the same step.
   */
  useEffect(() => {
    if (!lesson) return
    const current = lesson.steps[step]
    if (!current) return

    let advanceTimer = null
    let done = false
    const advance = () => {
      if (done) return
      done = true
      advanceTimer = setTimeout(() => {
        if (!playingRef.current) return
        if (stepRef.current >= lesson.steps.length - 1) {
          setPlaying(false)
          return
        }
        setStep((s) => Math.min(lesson.steps.length - 1, s + 1))
      }, 750)
    }
    // The last step's recording also says the answer; the server composes the
    // same text, and the board displays it under the lines.
    const answerSay = step >= lesson.steps.length - 1 ? lesson.answer?.say : ''
    const say = [current.say || current.title, answerSay].filter(Boolean).join(' ')

    if (narration.enabled && narration.supported) {
      narration.speak(lesson.id, step, {
        onEnd: advance,
        onError: () => setPlaying(false),
        next: step + 1 < lesson.steps.length ? step + 1 : undefined,
      })
    } else if (playing) {
      advanceTimer = setTimeout(advance, readingMs(say))
    }

    return () => {
      clearTimeout(advanceTimer)
      narration.stop()
    }
  }, [lesson, step, speakNonce, narration.enabled, narration.speak, narration.stop, narration.supported])

  // Arrow keys walk the lesson while the board is on screen.
  useEffect(() => {
    if (!lesson || studioOpen) return
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.metaKey || e.ctrlKey) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setStep((s) => Math.min(lesson.steps.length - 1, s + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setStep((s) => Math.max(0, s - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lesson, studioOpen])

  const materials = state.materials.filter((m) => m.status === 'ready' && m.pack?.sections?.length)

  const open = async (id) => {
    if (busy) return
    setLoadError('')
    setPlaying(false)
    narration.stop()
    setStep(0)
    try {
      setLesson(await actions.loadWhiteboardLesson(id))
      setStudioOpen(false)
    } catch (e) {
      setLoadError(e.message)
    }
  }

  const startNew = () => {
    setPlaying(false)
    narration.stop()
    setStudioOpen((open) => !open)
    setError('')
  }

  const togglePlay = () => {
    if (!lesson) return
    if (playing) {
      setPlaying(false)
      narration.stop()
      return
    }
    // Replaying from the answer restarts the lesson, like a teacher picking up
    // the marker again rather than finishing mid-sentence.
    if (step >= lesson.steps.length - 1) setStep(0)
    setPlaying(true)
    setSpeakNonce((n) => n + 1)
  }

  const onPhoto = async (file) => {
    setPhotoBusy(true)
    setError('')
    try {
      setImage(await preparePhoto(file))
    } catch (e) {
      setError(e.message)
      actions.toast(e.message, 'error')
    } finally {
      setPhotoBusy(false)
    }
  }

  const create = async () => {
    if (busy) return
    if (question.trim().length < 2 && !image) {
      setError('Type a question or add a photo first.')
      return
    }
    setBusy(true)
    setError('')
    setPlaying(false)
    narration.stop()
    try {
      const created = await actions.createWhiteboardLesson({
        question: question.trim(),
        image: image?.dataUrl,
        subject,
        materialId,
      })
      setLesson(created)
      setLessons((list) => [
        {
          id: created.id,
          title: created.title,
          subject: created.subject,
          summary: created.summary,
          question: created.question,
          source: created.source,
          steps: created.steps.length,
          createdAt: created.createdAt,
        },
        ...list.filter((l) => l.id !== created.id),
      ])
      setStep(0)
      setStudioOpen(false)
      setPlaying(true)
      setSpeakNonce((n) => n + 1)
      setQuestion('')
      setImage(null)
      setSubject('')
      setMaterialId('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!pendingDelete) return
    try {
      await actions.deleteWhiteboardLesson(pendingDelete.id)
      setLessons((list) => list.filter((l) => l.id !== pendingDelete.id))
      if (pendingDelete.id === lesson?.id) {
        setLesson(null)
        setPlaying(false)
        narration.stop()
        setStudioOpen(true)
      }
      setPendingDelete(null)
    } catch (e) {
      setLoadError(e.message)
      setPendingDelete(null)
    }
  }

  return (
    <div className="wb-page">
      <PageHeader title="Whiteboard Teacher" subtitle="Bring a question. Echo solves it on the board, one step at a time.">
        {lessons.length > 0 && (
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              railChosen.current = true
              setShowRail((v) => !v)
            }}
            aria-expanded={showRail}
          >
            {showRail ? 'Hide history' : `History${lessons.length ? ` (${lessons.length})` : ''}`}
          </button>
        )}
        {lesson && (
          <button type="button" className="btn btn-primary" onClick={startNew} disabled={busy}>
            {studioOpen ? 'Back to lesson' : 'New lesson'}
          </button>
        )}
      </PageHeader>

      {loadError && (
        <p className="wb-error" role="status">
          {loadError}
        </p>
      )}

      <div className={`wb-shell${showRail ? '' : ' is-solo'}`}>
        {showRail && (
          <LessonRail
            lessons={lessons}
            activeId={lesson?.id}
            onOpen={open}
            onNew={() => {
              setStudioOpen(true)
              setError('')
            }}
            onDelete={setPendingDelete}
            busy={busy}
          />
        )}

        <div className="wb-main">
          {loading && !lesson ? (
            <div className="wb-idle surface">
              <div className="wb-idle-echo" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div>
                <h3>Setting up the board…</h3>
                <p className="muted">Your recent lessons are on their way.</p>
              </div>
            </div>
          ) : studioOpen || !lesson ? (
            <TeacherStudio
              materials={materials}
              materialId={materialId}
              onMaterial={setMaterialId}
              question={question}
              onQuestion={setQuestion}
              subject={subject}
              onSubject={setSubject}
              image={image}
              onPhoto={onPhoto}
              onClearPhoto={() => setImage(null)}
              photoBusy={photoBusy}
              busy={busy}
              error={error}
              onSubmit={create}
            />
          ) : (
            <div className="wb-lesson">
              <BoardView
                lesson={lesson}
                stepIndex={step}
                playing={playing}
                sound={narration.enabled}
                supportedNarration={narration.supported}
                voiceError={narration.error}
                onPrev={() => setStep((s) => Math.max(0, s - 1))}
                onNext={() => setStep((s) => Math.min(lesson.steps.length - 1, s + 1))}
                onPlay={togglePlay}
                onRestart={() => {
                  setPlaying(false)
                  narration.stop()
                  setStep(0)
                }}
                onToggleSound={narration.toggle}
              />

              <ol className="wb-steps" aria-label="Lesson steps">
                {lesson.steps.map((s, i) => (
                  <li key={`${i}-${s.title}`}>
                    <button
                      type="button"
                      className={`wb-step${i === step ? ' is-on' : ''}${i < step ? ' is-done' : ''}`}
                      onClick={() => {
                        setStep(i)
                        if (i < lesson.steps.length - 1) setPlaying(false)
                      }}
                      aria-current={i === step ? 'step' : undefined}
                    >
                      <span className="wb-step-index">{i + 1}</span>
                      <span className="wb-step-name">{s.title}</span>
                    </button>
                  </li>
                ))}
              </ol>

              <p className="wb-shortcuts small muted">Arrow keys move between steps.</p>
            </div>
          )}
        </div>
      </div>

      <div className="page-note">
        <EchoNote>
          Bring any question — maths, science, history etc Echo will help you understand any concept
        </EchoNote>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this lesson?"
          message={`“${pendingDelete.title}” will be removed from your board for good.`}
          confirmLabel="Delete"
          danger
          onConfirm={remove}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
