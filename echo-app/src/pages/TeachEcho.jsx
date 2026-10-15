import { useEffect, useRef, useState } from 'react'
import PageHeader from '../components/ui/PageHeader.jsx'
import SelectField from '../components/ui/SelectField.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import EchoNote from '../components/ui/EchoNote.jsx'
import Button from '../components/ui/Button.jsx'
import Recorder from '../components/teach/Recorder.jsx'
import FeedbackPanel from '../components/teach/FeedbackPanel.jsx'
import useSpeech from '../hooks/useSpeech.js'
import useMaterialSelection from '../hooks/useMaterialSelection.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'
import { useCompanion } from '../components/mascot/companion-context.jsx'
import { teachScoreStory, teachListeningStory, teachNudgeStory } from '../components/mascot/scenarios.js'
import { useApp } from '../store/AppContext.jsx'
import { scoreExplanation, keyPointsFor } from '../lib/score.js'
import '../components/teach/teach.css'
import '../styles/pages.css'

export default function TeachEcho() {
  useDocumentTitle('Teach Echo')
  const { actions } = useApp()
  const { ready, material, section, setMaterial, setSection } = useMaterialSelection()
  const speech = useSpeech()
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [earned, setEarned] = useState(0)
  const companion = useCompanion()

  const topic = section || material?.pack.sections[0] || null
  // Some AI-written sections arrive without stored key points; derive them
  // from the section's own content so a good explanation is never refused.
  const keyPoints = keyPointsFor(topic)

  // While recording, the transcript fills the box.
  useEffect(() => {
    if (speech.listening) setText(speech.transcript)
  }, [speech.transcript, speech.listening])

  // Echo listens along with you while recording; a speech error confuses him.
  useEffect(() => {
    if (speech.listening) {
      const story = teachListeningStory()
      companion.react(story.pose, story.line, story.tone, story.ms)
    } else if (speech.error) companion.react('confused', speech.error, 'error')
  }, [speech.listening, speech.error]) // eslint-disable-line react-hooks/exhaustive-deps

  // Half a minute of silence gets a gentle nudge, once.
  const nudged = useRef(false)
  useEffect(() => {
    if (!speech.listening) {
      nudged.current = false
      return
    }
    const t = setTimeout(() => {
      if (nudged.current || !speech.listening) return
      const words = text.trim().split(/\s+/).filter(Boolean).length
      if (words < 8) {
        nudged.current = true
        const story = teachNudgeStory()
        companion.react(story.pose, story.line, story.tone, story.ms)
      }
    }, 30_000)
    return () => clearTimeout(t)
  }, [speech.listening, text]) // eslint-disable-line react-hooks/exhaustive-deps

  const clear = () => {
    speech.reset()
    setText('')
    setResult(null)
    setEarned(0)
  }

  if (!material || !topic) {
    return (
      <>
        <PageHeader title="Teach Echo" subtitle="Explain the topic in your own words." />
        <EmptyState title="Nothing to teach yet." action={<Button to="/app/materials">Upload your first notes</Button>}>
          Upload a file first, then explain one of its topics to Echo.
        </EmptyState>
      </>
    )
  }

  const submit = () => {
    speech.stop()
    const r = scoreExplanation(text, keyPoints)
    if (r.wordCount < 8) return actions.toast('Say or type a little more first. A few full sentences work best.', 'error')
    if (r.score === null) return actions.toast('This topic has no key points to check against.', 'error')
    setResult(r)
    actions
      .recordTeach({ materialId: material.id, sectionId: topic.id, topic: topic.title, score: r.score })
      .then(setEarned)
      .catch((e) => actions.toast(e.message, 'error'))
    const story = teachScoreStory(r.score)
    companion.react(story.pose, story.line, story.tone, story.ms)
  }

  return (
    <>
      <PageHeader title="Teach Echo" subtitle="Explain the topic in your own words. Echo checks it against your notes." />

      <div className="side-by-side">
        <div className="narrow">
          <div className="topic-picker">
            <SelectField label="Material" value={material.id} onChange={(id) => { clear(); setMaterial(id) }} options={ready.map((m) => ({ value: m.id, label: m.title }))} />
            <SelectField label="Topic" value={topic.id} onChange={(id) => { clear(); setSection(id) }} options={material.pack.sections.map((s) => ({ value: s.id, label: s.title }))} />
          </div>

          <Recorder topic={topic.title} speech={speech} onStart={() => speech.start(text)} onStop={speech.stop} />

          <div className="explain-box">
            <label className="field">
              <span>Your explanation</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                readOnly={speech.listening}
                placeholder="Press the red button and explain the topic out loud, or type it here."
              />
            </label>
            <p className="interim" aria-live="off">{speech.listening ? speech.interim : ''}</p>
            <div className="btn-row">
              <button type="button" className="btn btn-primary" onClick={submit} disabled={!text.trim()}>Get feedback</button>
              <button type="button" className="btn btn-quiet" onClick={clear}>Clear</button>
              <span className="small muted">Echo will check {keyPoints.length} key points.</span>
            </div>
          </div>

          {result && <FeedbackPanel result={result} xp={earned} onRetry={clear} />}
        </div>
      </div>

      <div className="page-note">
        <EchoNote>Explain it like you are teaching a friend. If you cannot say it simply, that is the part to revise.</EchoNote>
      </div>
    </>
  )
}
