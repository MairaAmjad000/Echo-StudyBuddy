import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import Echo from '/src/strobi-avatar/Strobi.tsx'
import './whiteboard.css'

/** Cheap check for whether a line should go through the math renderer. */
function looksLikeMath(text) {
  const s = String(text || '')
  return /\\|\^|_|=|<|>|\d\s*[+\-*/]|[+\-*/]\s*\d/.test(s)
}

function renderMath(text) {
  try {
    return katex.renderToString(String(text || ''), {
      throwOnError: false,
      displayMode: false,
      strict: 'ignore',
      output: 'html',
    })
  } catch {
    return ''
  }
}

function BoardLine({ line, index }) {
  if (line.kind === 'math') {
    return (
      <div className="wb-line wb-line-math" style={{ '--i': index }}>
        <span className="wb-line-body" dangerouslySetInnerHTML={{ __html: renderMath(line.text) }} />
      </div>
    )
  }
  return (
    <div className={`wb-line wb-line-${line.kind}`} style={{ '--i': index }}>
      <span className="wb-line-body">{line.text}</span>
    </div>
  )
}

/**
 * The whiteboard itself.
 *
 * One step at a time is written on the board, each line revealing after the
 * one above it — the writing effect is a left-to-right wipe, which reads as a
 * hand moving across the board without shipping a handwriting font or a canvas
 * animation engine. Math is typeset by KaTeX (MIT, bundled locally), so
 * fractions and roots look like a textbook instead of plain text. Everything
 * still renders immediately when motion is reduced: the wipe is the only
 * difference.
 *
 * The board deliberately keeps the same white sheet in dark mode. A whiteboard
 * that turns navy is no longer a whiteboard; the ink stays navy and the sheet
 * stays white, with only its frame following the theme.
 */
export default function Whiteboard({
  lesson,
  stepIndex,
  playing,
  sound,
  supportedNarration,
  voiceError,
  onPrev,
  onNext,
  onPlay,
  onRestart,
  onToggleSound,
}) {
  const total = lesson.steps.length
  const step = lesson.steps[stepIndex]
  const last = stepIndex >= total - 1
  const answerIsMath = useMemo(() => looksLikeMath(lesson.answer?.text), [lesson.answer?.text])

  const pose = last ? 'proud' : playing ? 'working' : 'listening'
  const sayText = last && lesson.answer?.say ? `${step.say} ${lesson.answer.say}`.trim() : step.say

  return (
    <section className="wb-stage" aria-label="Whiteboard lesson">
      <div className="wb-board">
        <div className="wb-board-head">
          <p className="wb-board-title" title={lesson.title}>
            {lesson.title}
          </p>
          <span className="wb-subject">{lesson.subject}</span>
        </div>

        <div className="wb-page" key={stepIndex}>
          <h2 className="wb-step-title">
            <span className="wb-step-num">{stepIndex + 1}</span>
            {step.title}
          </h2>

          <div className="wb-lines">
            {step.lines.map((line, i) => (
              <BoardLine key={`${i}-${line.text}`} line={line} index={i} />
            ))}
          </div>

          {last && lesson.answer?.text && (
            <div className="wb-answer" style={{ '--i': step.lines.length }}>
              <span className="wb-answer-label">Answer</span>
              {answerIsMath ? (
                <span className="wb-answer-math" dangerouslySetInnerHTML={{ __html: renderMath(lesson.answer.text) }} />
              ) : (
                <span className="wb-answer-text">{lesson.answer.text}</span>
              )}
            </div>
          )}
        </div>

        <p className="sr-only" aria-live="polite">
          {`Step ${stepIndex + 1} of ${total}: ${step.title}. ${step.say}`}
        </p>
      </div>

      {voiceError && (
        <p className="wb-voice-error" role="alert">
          {voiceError}
        </p>
      )}

      <div className="wb-teachbar">
        <Echo size={62} animation={pose} className="wb-echo" />
        <div className="wb-say">
          <p>{sayText || lesson.summary}</p>
          <span className="wb-say-meta">
            Step {stepIndex + 1} of {total}
            {lesson.materialTitle ? ` · from ${lesson.materialTitle}` : ''}
          </span>
        </div>
        <button
          type="button"
          className={`wb-sound${sound ? ' is-on' : ''}`}
          onClick={onToggleSound}
          aria-pressed={sound}
          title={supportedNarration ? 'Read the lesson in Echo’s podcast voice' : 'This browser cannot play audio'}
          disabled={!supportedNarration}
        >
          {sound ? 'Sound on' : 'Sound off'}
        </button>
      </div>

      <div className="wb-transport">
        <div className="wb-progress" aria-hidden="true">
          <div className="wb-progress-bar">
            <i style={{ width: `${((stepIndex + 1) / total) * 100}%` }} />
          </div>
          <span className="wb-progress-label">
            {stepIndex + 1} / {total}
          </span>
        </div>

        <div className="wb-transport-buttons">
          <button type="button" className="btn btn-quiet wb-nav" onClick={onPrev} disabled={stepIndex === 0}>
            Back
          </button>
          <button type="button" className="btn btn-primary wb-play" onClick={onPlay}>
            {playing ? 'Pause' : last ? 'Replay' : 'Play lesson'}
          </button>
          <button type="button" className="btn btn-quiet wb-nav" onClick={onNext} disabled={last}>
            Next
          </button>
          <button type="button" className="btn btn-quiet wb-restart" onClick={onRestart}>
            Restart
          </button>
        </div>
      </div>
    </section>
  )
}
