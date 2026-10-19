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
  const r = useRef({
    rec: null,
    stream: null,
    ctx: null,
    node: null,
    timer: null,
    guard: null,
    active: false,
    final: '',
    live: '',
    heard: 0,
    recovered: false,
    recoveredAt: 0,
  })

  const stop = useCallback(() => {
    const x = r.current
    x.active = false
    try { x.rec?.stop() } catch { /* already stopped */ }
    x.stream?.getTracks().forEach((t) => t.stop())
    x.ctx?.close?.().catch(() => {})
    clearInterval(x.timer)
    clearInterval(x.guard)
    // Words the browser had not committed yet are still words that were said:
    // fold the live text in, so stopping the recorder never loses them.
    if (x.live) {
      x.final += x.live + ' '
      x.live = ''
    }
    x.rec = x.stream = x.ctx = x.node = x.guard = null
    setAnalyser(null)
    setListening(false)
    setTranscript(x.final)
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
        // Ask for the device's own flavour of English when it is English;
        // every other system language stays en-US, because the material and
        // the key points Echo scores against are written in English.
        rec.lang = (navigator.language || '').toLowerCase().startsWith('en') ? navigator.language : 'en-US'
        r.current = {
          rec,
          stream,
          ctx,
          node,
          timer: null,
          guard: null,
          active: true,
          final: base ? base.trim() + ' ' : '',
          live: '',
          heard: 0,
          recovered: false,
          recoveredAt: 0,
        }

        // Some Android Chrome builds cannot feed the microphone to the speech
        // service while a second component — our waveform — is also capturing
        // from it: the recording UI runs, but no text ever comes back. When
        // that happens, hand the microphone to the recognition alone. The
        // waveform goes flat, the words start arriving.
        const giveMicToRecognition = () => {
          const x = r.current
          if (x.recovered || !x.active) return
          x.recovered = true
          x.recoveredAt = Date.now()
          stream.getTracks().forEach((t) => t.stop())
          ctx.close?.().catch(() => {})
          setAnalyser(null)
          try { rec.stop() } catch { /* already ended */ }
        }

        rec.onresult = (e) => {
          let live = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i]
            if (res.isFinal) r.current.final += res[0].transcript + ' '
            else live += res[0].transcript
            r.current.heard += 1
          }
          r.current.live = live
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
          } else if (ev.error === 'audio-capture') {
            // The mic dropped out or is held by something else. If our own
            // waveform is still capturing, give it up and start over.
            if (r.current.recovered) {
              setError('The microphone stopped responding. Type your explanation instead.')
              stop()
            } else {
              giveMicToRecognition()
            }
          } else if (ev.error === 'language-not-supported') {
            setError('This browser cannot recognise English speech. Type your explanation instead.')
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

        // Watchdog for the phones where nothing comes back: while the student
        // is audibly speaking and the service stays completely silent, hand
        // the microphone over once. Silence before that is normal — someone
        // may simply be gathering their thoughts — so it never triggers.
        const probe = new Float32Array(node.fftSize)
        let speakingMs = 0
        r.current.guard = setInterval(() => {
          const x = r.current
          if (!x.active) return
          if (x.recovered) {
            // The waveform is gone, so after the hand-over it is time, not
            // level, that decides: fifteen seconds of speaking produced
            // nothing, this browser is not going to produce text.
            if (x.heard === 0 && Date.now() - x.recoveredAt > 15_000) {
              setError('Nothing is coming through in this browser. Type your explanation instead.')
              stop()
            }
            return
          }
          if (x.heard > 0) return
          let peak = 0
          try {
            node.getFloatTimeDomainData(probe)
            for (let i = 0; i < probe.length; i++) peak = Math.max(peak, Math.abs(probe[i]))
          } catch { return }
          if (peak < 0.05) return
          speakingMs += 500
          if (speakingMs < 5000) return
          speakingMs = 0
          giveMicToRecognition()
        }, 500)
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
