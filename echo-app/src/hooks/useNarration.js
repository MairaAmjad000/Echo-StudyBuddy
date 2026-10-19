import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAudio, whiteboardAudioUrl } from '../lib/api.js'

/**
 * Echo's voice for the Whiteboard Teacher.
 *
 * This is deliberately the same voice as Podcast with Echo: the server records
 * each step with the free Microsoft Edge "Read Aloud" voice (lib/tts.js), and
 * this hook plays the MP3. Nothing is billed per word, and the browser caches
 * each step for a week, so walking back through a lesson costs no requests.
 *
 * The hook owns the awkward parts of playing recorded speech inside an app:
 *   * one Audio element for the page, so a new step replaces the old one
 *     instead of layering a second voice on top;
 *   * a request token, so the late `ended` event of a cancelled step can never
 *     advance the lesson twice;
 *   * one step of prefetch, so the hand-over between steps is instant;
 *   * the browser's autoplay refusal (NotAllowedError) is reported as a line
 *     the page can act on — pressing Play is a gesture, and it starts the step.
 */
export default function useNarration(lessonId) {
  const supported = typeof window !== 'undefined' && typeof Audio !== 'undefined'
  const [enabled, setEnabled] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const [error, setError] = useState('')

  const audioRef = useRef(null)
  const cacheRef = useRef(new Map()) // "lessonId:index" -> object URL
  const inflightRef = useRef(new Map()) // "lessonId:index" -> Promise<object URL>
  const cacheGeneration = useRef(0)
  const token = useRef(0)
  // The token of the recording currently loaded into the element. A late
  // `ended` event from a cancelled step carries the old token and is ignored.
  const sourceToken = useRef(0)
  const finish = useRef(null)
  const fail = useRef(null)
  const enabledRef = useRef(true)

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  /** Fetch a step's MP3 once and keep it as a blob URL for the page's lifetime. */
  const ensureUrl = useCallback((id, index) => {
    const key = `${id}:${index}`
    const cached = cacheRef.current.get(key)
    if (cached) return Promise.resolve(cached)
    const pending = inflightRef.current.get(key)
    if (pending) return pending

    const generation = cacheGeneration.current
    const request = (async () => {
      const res = await fetchAudio(whiteboardAudioUrl(id, index))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      // The page moved to another lesson while this was downloading: do not
      // keep a blob nobody will play.
      if (generation !== cacheGeneration.current) {
        URL.revokeObjectURL(url)
        throw new Error('That lesson changed before the voice arrived.')
      }
      cacheRef.current.set(key, url)
      return url
    })()
    inflightRef.current.set(key, request)
    return request.finally(() => inflightRef.current.delete(key))
  }, [])

  /** Silence the voice immediately. The token makes any in-flight step inert. */
  const stop = useCallback(() => {
    token.current += 1
    sourceToken.current = 0
    finish.current = null
    fail.current = null
    const audio = audioRef.current
    if (audio) {
      try {
        audio.pause()
      } catch {
        /* nothing playing */
      }
    }
    setSpeaking(false)
  }, [])

  /**
   * Speak one step. `onEnd` runs when the recording finishes; `onError` runs
   * when the voice cannot be fetched or the browser refuses to play it.
   * `next` is prefetched while this step plays.
   */
  const speak = useCallback(
    async (id, index, { onEnd, onError, next } = {}) => {
      if (!supported || !enabledRef.current || !id || !Number.isInteger(index)) return false
      setError('')
      const audio = audioRef.current
      if (!audio) return false

      // Stop whatever is playing before the next request, and take a token so
      // this attempt owns the element from here on.
      audio.pause()
      const idAtStart = ++token.current
      finish.current = onEnd || null
      fail.current = onError || null

      try {
        const url = await ensureUrl(id, index)
        if (idAtStart !== token.current) return false
        audio.src = url
        sourceToken.current = idAtStart
        audio.currentTime = 0
        await audio.play()
        if (idAtStart !== token.current) {
          audio.pause()
          return false
        }
        setSpeaking(true)
        if (Number.isInteger(next)) ensureUrl(id, next).catch(() => {})
        return true
      } catch (err) {
        if (idAtStart !== token.current) return false
        finish.current = null
        fail.current = null
        setSpeaking(false)
        const message =
          err?.name === 'NotAllowedError'
            ? 'Your browser paused the voice. Press Play to hear this step.'
            : err?.status === 503
              ? err.message || 'Echo’s voice needs a few seconds. Press Play to try again.'
              : err?.message || 'That step could not be played. Press Play to try again.'
        setError(message)
        onError?.(err)
        return false
      }
    },
    [ensureUrl, supported],
  )

  // One audio element for the life of the page.
  useEffect(() => {
    if (!supported) return undefined
    const audio = new Audio()
    audio.preload = 'auto'
    audioRef.current = audio

    const onEnded = () => {
      // A cancelled step can still deliver its `ended` event; only the step
      // that owns the element may advance the lesson.
      if (sourceToken.current !== token.current) return
      const callback = finish.current
      finish.current = null
      fail.current = null
      setSpeaking(false)
      callback?.()
    }
    const onError = () => {
      if (sourceToken.current !== token.current) return
      const callback = fail.current
      finish.current = null
      fail.current = null
      setSpeaking(false)
      setError('That step could not be played. Press Play to try again.')
      callback?.(new Error('Audio playback failed'))
    }

    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      token.current += 1
      finish.current = null
      fail.current = null
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
      cacheRef.current.forEach((url) => URL.revokeObjectURL(url))
      cacheRef.current.clear()
      inflightRef.current.clear()
    }
  }, [supported])

  // A different lesson is a different set of recordings: release the old blobs
  // but leave the audio element alone.
  useEffect(() => {
    return () => {
      cacheGeneration.current += 1
      cacheRef.current.forEach((url) => URL.revokeObjectURL(url))
      cacheRef.current.clear()
      inflightRef.current.clear()
    }
  }, [lessonId])

  const toggle = useCallback(() => {
    const next = !enabledRef.current
    enabledRef.current = next
    setEnabled(next)
    setError('')
    if (!next) {
      token.current += 1
      finish.current = null
      fail.current = null
      audioRef.current?.pause()
      setSpeaking(false)
    }
  }, [])

  return { supported, enabled, speaking, error, speak, stop, toggle }
}
