import { useCallback, useEffect, useRef, useState } from 'react'

const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

const UA = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
// A phone or tablet hands the microphone to the speech service while it
// listens. A second capture of our own — the waveform's analyser — makes the
// service read silence instead, so recognition sits there running and no words
// ever come back. Touch devices therefore record with the service alone.
const TOUCH =
  typeof window !== 'undefined' &&
  (!!window.matchMedia?.('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(UA))
// Chrome on iOS is Safari's engine with Google's name on it: it exposes no
// speech recognition at all, so the usual "Chrome works" advice is wrong there.
const IOS_BROWSER = /CriOS|FxiOS|EdgiOS/i.test(UA)
const SECURE = typeof window !== 'undefined' ? window.isSecureContext !== false : true

const REASON = !SECURE
  ? 'Voice typing needs a secure page. Open the app over https (or localhost) to use the microphone, or type your explanation instead.'
  : IOS_BROWSER
    ? 'On iPhone and iPad voice typing only works in Safari. Type your explanation instead.'
    : !SR
      ? 'This browser cannot turn speech into text (Chrome on Android, Edge and Safari can). Type your explanation instead.'
      : ''

/**
 * Microphone + speech-to-text for Teach Echo, using the browser's built-in
 * SpeechRecognition. Audio is handled by the browser; nothing is uploaded.
 */
export default function useSpeech() {
  const supported = !!SR && SECURE
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [analyser, setAnalyser] = useState(null)
  const r = useRef({
    rec: null,
    stream: null,
    ctx: null,
    timer: null,
    hintTimer: null,
    restartTimer: null,
    active: false,
    final: '',
    live: '',
    heard: 0,
    audio: false,
    fastEnds: 0,
    lastEndAt: 0,
    startedAt: 0,
  })

  // Giving our own capture of the microphone back. On desktop this is only the
  // level meter; when the service complains the mic is taken, this is what
  // frees it — the waveform goes flat and the words start arriving.
  const releaseMic = useCallback(() => {
    const x = r.current
    x.stream?.getTracks().forEach((t) => t.stop())
    x.ctx?.close?.().catch(() => {})
    x.stream = null
    x.ctx = null
    setAnalyser(null)
  }, [])

  const stop = useCallback(() => {
    const x = r.current
    x.active = false
    try { x.rec?.stop() } catch { /* already stopped */ }
    clearInterval(x.timer)
    clearInterval(x.hintTimer)
    clearTimeout(x.restartTimer)
    releaseMic()
    // Words the browser had not committed yet are still words that were said:
    // fold the live text in, so stopping the recorder never loses them.
    if (x.live.trim()) x.final += `${x.live.trim()} `
    x.live = ''
    x.rec = null
    x.timer = x.hintTimer = x.restartTimer = null
    setListening(false)
    setTranscript(x.final)
    setInterim('')
    setHint('')
  }, [releaseMic])

  const start = useCallback(
    async (base = '') => {
      if (!supported || r.current.active) return
      setError('')
      setHint('')

      // Desktop keeps a real level meter; a phone records with the service
      // alone, which is the whole point of the split above.
      let stream = null
      let ctx = null
      let node = null
      if (!TOUCH && navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          ctx = new (window.AudioContext || window.webkitAudioContext)()
          node = ctx.createAnalyser()
          node.fftSize = 128
          ctx.createMediaStreamSource(stream).connect(node)
        } catch {
          // A blocked or busy microphone is not fatal on its own: recognition
          // may still reach the mic by itself. Losing the meter costs nothing.
          stream = null
          ctx = null
          node = null
        }
      }

      let rec
      try {
        rec = new SR()
      } catch {
        setError('This browser refused to start voice typing. Type your explanation instead.')
        return
      }

      const x = {
        rec,
        stream,
        ctx,
        timer: null,
        hintTimer: null,
        restartTimer: null,
        active: true,
        final: base ? base.trim() + ' ' : '',
        live: '',
        heard: 0,
        audio: false,
        fastEnds: 0,
        lastEndAt: 0,
        startedAt: Date.now(),
      }
      r.current = x

      rec.continuous = true
      rec.interimResults = true
      rec.maxAlternatives = 1
      // Ask for the device's own flavour of English when it is English; every
      // other system language stays en-US, because the material and the key
      // points Echo scores against are written in English.
      rec.lang = (navigator.language || '').toLowerCase().startsWith('en') ? navigator.language : 'en-US'

      rec.onstart = () => { if (r.current.active) setListening(true) }
      // The service telling us it is hearing something: on a phone this is the
      // only proof of life there is, now that we do not hold the mic ourselves.
      rec.onaudiostart = () => { r.current.audio = true }
      rec.onsoundstart = () => { r.current.audio = true }
      rec.onspeechstart = () => { r.current.audio = true }

      rec.onresult = (e) => {
        const cur = r.current
        let live = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]
          if (res.isFinal) cur.final += `${res[0].transcript.trim()} `
          else live += res[0].transcript
        }
        cur.heard += 1
        cur.live = live
        cur.fastEnds = 0
        setHint('')
        setTranscript(cur.final)
        setInterim(live)
      }

      rec.onerror = (ev) => {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          setError('Microphone access was blocked. Allow it for this site in your browser, then try again.')
          stop()
        } else if (ev.error === 'network') {
          setError('Speech recognition needs an internet connection in this browser.')
          stop()
        } else if (ev.error === 'audio-capture') {
          if (r.current.stream) {
            // Our own level meter was fighting the service for the microphone.
            releaseMic()
          } else {
            setError('The microphone is not available right now. Type your explanation instead.')
            stop()
          }
        } else if (ev.error === 'language-not-supported') {
          setError('This browser cannot recognise English speech. Type your explanation instead.')
          stop()
        }
        // 'no-speech' and 'aborted' are the service clocking out for a moment;
        // onend restarts it, so they are not errors worth showing.
      }

      rec.onend = () => {
        const cur = r.current
        if (!cur.active) return
        const now = Date.now()
        // Ends that come straight back, over and over, mean the service is not
        // starting at all — that is the one case worth giving up on. A long
        // silence also ends the service, but it takes seconds, not a blink.
        cur.fastEnds = now - cur.lastEndAt < 1200 ? cur.fastEnds + 1 : 0
        cur.lastEndAt = now
        if (cur.fastEnds > 4) {
          setError('Voice typing keeps stopping in this browser. Type your explanation instead.')
          stop()
          return
        }
        // Chrome ends the service after a short silence even in continuous
        // mode, and rejects an immediate start(), so the next round waits a beat.
        clearTimeout(cur.restartTimer)
        cur.restartTimer = setTimeout(() => {
          const live = r.current
          if (!live.active || !live.rec) return
          try { live.rec.start() } catch { /* the service is not ready yet */ }
        }, 300)
      }

      try {
        rec.start()
      } catch {
        setError('Could not start voice typing. Type your explanation instead.')
        stop()
        return
      }

      r.current.timer = setInterval(() => setSeconds((s) => s + 1), 1000)
      setAnalyser(node)
      setListening(true)

      // With no microphone tap of our own there is nothing to measure, so all
      // we can watch is the service: twenty seconds of no audio and no words is
      // worth a quiet nudge — not an error, and not a stop.
      r.current.hintTimer = setInterval(() => {
        const cur = r.current
        if (!cur.active) return
        if (cur.heard > 0 || cur.audio) {
          clearInterval(cur.hintTimer)
          return
        }
        if (Date.now() - cur.startedAt > 20_000) {
          setHint('No words yet. Try speaking a little closer to the phone, or check the connection.')
        }
      }, 1000)
    },
    [supported, stop, releaseMic],
  )

  const reset = useCallback(() => {
    stop()
    r.current.final = ''
    setTranscript('')
    setSeconds(0)
    setError('')
  }, [stop])

  useEffect(() => stop, [stop])

  return { supported, reason: REASON, listening, transcript, interim, seconds, error, hint, analyser, start, stop, reset }
}
