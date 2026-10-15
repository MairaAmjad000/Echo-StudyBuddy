import { useState } from 'react'
import PageHeader from '../components/ui/PageHeader.jsx'
import EchoNote from '../components/ui/EchoNote.jsx'
import DropZone from '../components/upload/DropZone.jsx'
import LinkForm from '../components/upload/LinkForm.jsx'
import MaterialList from '../components/upload/MaterialList.jsx'
import { useApp } from '../store/AppContext.jsx'
import { extractFromFile, parseYouTube, MIN_TEXT } from '../lib/extract.js'
import { stripExt } from '../lib/format.js'
import useDocumentTitle from '../hooks/useDocumentTitle.js'
import { useCompanion } from '../components/mascot/companion-context.jsx'
import '../components/upload/upload.css'
import '../styles/pages.css'

const MAX_BYTES = 25 * 1024 * 1024

export default function UploadMaterial() {
  useDocumentTitle('My Materials')
  const { state, actions } = useApp()
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [errors, setErrors] = useState([])
  const companion = useCompanion()

  //
  // Extraction stays in the browser (pdf/docx parsing runs locally), but the
  // study pack is built on the server: Gemini writes the notes/cards/questions
  // when the AI key is configured, with the rule-based generator as fallback.
  //
  const readableLength = (input) =>
    input.sections
      ? input.sections.reduce((n, s) => n + s.lines.join(' ').length, 0)
      : (input.text || '').trim().length

  const handleFiles = async (files) => {
    setBusy(true)
    setErrors([])
    const failed = []
    for (const file of files) {
      try {
        if (file.size > MAX_BYTES) throw new Error('This file is over 25 MB.')
        setStage(`Reading ${file.name}...`)
        const input = await extractFromFile(file)
        if (readableLength(input) < MIN_TEXT) throw new Error('There is almost no text in this file. Scanned PDFs are pictures and need OCR first.')
        setStage(`Echo is building notes, cards and a quiz from ${file.name}...`)
        companion.react('working', `Reading ${file.name}. Give me a moment.`, undefined, 6000)
        const material = await actions.addMaterial({
          title: stripExt(file.name),
          type: input.type,
          status: 'ready',
          text: input.text || '',
          sections: input.sections,
        })
        actions.toast(`Notes ready: ${material.title}`, 'success')
        if (companion) companion.react('celebrate', `Notes ready from ${material.title}!`, 'success', 5000)
      } catch (e) {
        failed.push(`${file.name}: ${e.message}`)
        if (companion) companion.react('confused', e.message, 'error', 5000)
      }
    }
    setErrors(failed)
    setStage('')
    setBusy(false)
  }

  const handleLink = async ({ url, transcript }) => {
    const videoId = parseYouTube(url)
    const text = (transcript || '').trim()
    // A link alone never becomes a material: the transcript is required too.
    if (text.length < MIN_TEXT) {
      actions.toast('A YouTube link needs its transcript too — paste both.', 'error')
      return false
    }
    setBusy(true)
    try {
      await actions.addMaterial({ title: `YouTube video ${videoId}`, type: 'youtube', sourceUrl: url, status: 'ready', text })
      actions.toast('Notes built from the transcript.', 'success')
      return true
    } catch (e) {
      setErrors([e.message])
      return false
    } finally {
      setBusy(false)
    }
  }

  const handleTranscript = async (material, text) => {
    if (text.trim().length < MIN_TEXT) {
      actions.toast('Paste a longer transcript, at least a few paragraphs.', 'error')
      return false
    }
    setBusy(true)
    try {
      await actions.completeMaterial(material.id, { transcript: text.trim() })
      actions.toast('Notes built from the transcript.', 'success')
      return true
    } catch (e) {
      actions.toast(e.message, 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Upload Material" subtitle="Give Echo anything you study from and it turns it into notes, cards and a quiz." />

      <div className="upload-grid">
        <div>
          <div className="drop-row">
            <DropZone onFiles={handleFiles} busy={busy} />
          </div>
          {stage && <p className="stage" role="status">{stage}</p>}
          {errors.map((e, i) => <p key={i} className="field-error upload-error" role="alert">{e}</p>)}
        </div>
        <LinkForm onSubmit={handleLink} busy={busy} />
      </div>

      <section className="recent">
        <h2>Recently uploaded</h2>
        <MaterialList
          materials={state.materials}
          busy={busy}
          onRemove={(m) => {
            actions.removeMaterial(m.id)
            actions.toast(`“${m.title}” removed. Everything else is untouched.`, 'info')
          }}
          onTranscript={handleTranscript}
        />
      </section>

      <div className="page-note">
        <EchoNote>I read your file on this device and pick out headings, definitions and key terms. Files with clear headings give the best notes.</EchoNote>
      </div>
    </>
  )
}
