import { useCallback, useEffect, useRef, useState } from 'react'

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

/**
 * Microphone + speech-to-text for Teach Echo, using the browser's built-in SpeechRecognition
 * (works in Chrome, Edge and Safari; Firefox has no support). Audio is handled by the browser.
 */
export default function useSpeech() {
  const supported = !!SR && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [analyser, setAnalyser] = useState(null)
  const r = useRef({ rec: null, stream: null, ctx: null, timer: null, active: false, final: '' })

  const stop = useCallback(() => {
    const x = r.current
    x.active = false
    try { x.rec?.stop() } catch { /* already stopped */ }
    x.stream?.getTracks().forEach((t) => t.stop())
    x.ctx?.close?.().catch(() => {})
    clearInterval(x.timer)
    x.rec = x.stream = x.ctx = null
    setAnalyser(null)
    setListening(false)
    setInterim('')
  }, [])

  const start = useCallback(
    async (base = '') => {
      if (!supported || r.current.active) return
      setError('')
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const node = ctx.createAnalyser()
        node.fftSize = 128
        ctx.createMediaStreamSource(stream).connect(node)

        const rec = new SR()
        rec.continuous = true
        rec.interimResults = true
        rec.lang = 'en-US'
        r.current = { rec, stream, ctx, timer: null, active: true, final: base ? base.trim() + ' ' : '' }

        rec.onresult = (e) => {
          let live = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i]
            if (res.isFinal) r.current.final += res[0].transcript + ' '
            else live += res[0].transcript
          }
          setTranscript(r.current.final)
          setInterim(live)
        }
        rec.onerror = (ev) => {
          if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
            setError('Microphone access was blocked. Allow it in your browser, or type your explanation instead.')
            stop()
          } else if (ev.error === 'network') {
            setError('Speech recognition needs an internet connection in this browser.')
            stop()
          }
        }
        rec.onend = () => {
          if (r.current.active) {
            try { rec.start() } catch { /* restarting too fast */ }
          }
        }
        rec.start()
        r.current.timer = setInterval(() => setSeconds((s) => s + 1), 1000)
        setAnalyser(node)
        setListening(true)
      } catch {
        setError('Could not open the microphone. Type your explanation instead.')
        stop()
      }
    },
    [supported, stop],
  )

  const reset = useCallback(() => {
    stop()
    r.current.final = ''
    setTranscript('')
    setSeconds(0)
  }, [stop])

  useEffect(() => stop, [stop])

  return { supported, listening, transcript, interim, seconds, error, analyser, start, stop, reset }
}
