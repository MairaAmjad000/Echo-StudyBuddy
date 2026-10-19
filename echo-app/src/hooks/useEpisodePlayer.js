import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { audioUrl, fetchAudio } from '../lib/api.js'
import { clamp } from '../lib/format.js'

/**
 * The player behind Podcast with Echo.
 *
 * An episode is not one file: the server records it a turn at a time, the first
 * time each turn is played, so the audio arrives as one MP3 per turn. This hook
 * is what turns those turns back into something that behaves like a podcast:
 *
 *   * it fetches the turn being played and keeps the blob in memory, then plays
 *     the next turn from memory the moment the current one ends;
 *   * it fetches one and two turns ahead while the student listens, so the
 *     hand-over is usually instant and the free voice service is never asked
 *     for a burst (two requests at a time, never more);
 *   * it measures each turn as it loads and reports the true running time,
 *     because the estimate the server wrote is only an estimate;
 *   * it reports the turn being played so the page can highlight the script and
 *     remember where the student stopped.
 *
 * Speed is handled by the audio element (1, 1.25, 1.5 or slower), never by
 * re-recording a turn: the browser resamples, so the voice keeps its pitch.
 */

/** Speeds offered in the player. Below 1 is for a first pass, above for a walk. */
export const RATES = [0.85, 1, 1.25, 1.5]

/** How many turns ahead to fetch while one is playing. Two is enough to ride
 * out a slow turn and gentle on the voice service. */
const AHEAD = 2

/** Where the current turn is remembered, for "pick up where you left off".
 * Saving on every turn would be a request per turn; ten seconds is often. */
const SAVE_GAP_MS = 10_000

const slug = (text) => String(text || 'episode').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'episode'

export default function useEpisodePlayer(episode, { onTurnChange, onSavePosition } = {}) {
  const total = episode?.segments?.length || 0
  const audioRef = useRef(null)
  const cacheRef = useRef(new Map()) // index -> object URL
  const inflightRef = useRef(new Map()) // index -> Promise<object URL>
  const aliveRef = useRef(true)
  const downloadingRef = useRef(false)
  const savedRef = useRef({ index: -1, at: 0 })

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [measured, setMeasured] = useState({}) // index -> seconds, as played
  const [rate, setRate] = useState(1)
  const [download, setDownload] = useState(null) // { done, total } while saving

  // Values the event handlers need, kept in refs so the listeners never go stale.
  const indexRef = useRef(0)
  indexRef.current = index
  const totalRef = useRef(total)
  totalRef.current = total
  const playingRef = useRef(false)
  playingRef.current = playing
  const rateRef = useRef(rate)
  rateRef.current = rate
  const callbacksRef = useRef({ onTurnChange, onSavePosition })
  callbacksRef.current = { onTurnChange, onSavePosition }
  const episodeRef = useRef(episode)
  episodeRef.current = episode

  /** The MP3 of one turn, from memory or from the server, kept as a blob URL. */
  const ensureUrl = useCallback((i) => {
    if (cacheRef.current.has(i)) return Promise.resolve(cacheRef.current.get(i))
    if (inflightRef.current.has(i)) return inflightRef.current.get(i)

    const request = (async () => {
      const res = await fetchAudio(audioUrl(episodeRef.current.id, i))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      cacheRef.current.set(i, url)
      return url
    })()
    inflightRef.current.set(i, request)
    return request.finally(() => inflightRef.current.delete(i))
  }, [])

  /** Fetch a turn ahead of time. A failed prefetch is not worth a message: the
   * turn will be asked for again when it is actually needed. */
  const prefetch = useCallback(
    (i) => {
      if (i < 0 || i >= totalRef.current || cacheRef.current.has(i) || inflightRef.current.has(i)) return
      ensureUrl(i).catch(() => {})
    },
    [ensureUrl],
  )

  const start = useCallback(
    async (target) => {
      const audio = audioRef.current
      if (!audio || !totalRef.current) return
      const at = clamp(target, 0, totalRef.current - 1)
      setError('')
      setBusy(true)
      try {
        const url = await ensureUrl(at)
        if (!aliveRef.current) return
        if (indexRef.current !== at) setIndex(at)
        setElapsed(0)
        audio.src = url
        audio.playbackRate = rateRef.current
        await audio.play()
        if (!aliveRef.current) return
        setPlaying(true)
        callbacksRef.current.onTurnChange?.(at)
        for (let step = 1; step <= AHEAD; step++) prefetch(at + step)
      } catch (err) {
        if (!aliveRef.current || err?.name === 'AbortError') return
        playFailure(err, setError)
        setPlaying(false)
      } finally {
        if (aliveRef.current) setBusy(false)
      }
    },
    [ensureUrl, prefetch],
  )

  // One audio element for the life of the page, with the listeners that make a
  // series of turns behave like one recording.
  useEffect(() => {
    aliveRef.current = true
    const audio = new Audio()
    audio.preload = 'auto'
    audioRef.current = audio

    const onTime = () => setElapsed(audio.currentTime)
    const onMeta = () => {
      // The true length of a turn is only known once the browser has read it.
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        const at = indexRef.current
        setMeasured((m) => (m[at] === audio.duration ? m : { ...m, [at]: audio.duration }))
      }
    }
    const onEnded = () => {
      const next = indexRef.current + 1
      if (next < totalRef.current) start(next)
      else {
        setPlaying(false)
        callbacksRef.current.onTurnChange?.(indexRef.current, { finished: true })
      }
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onError = () => {
      setError('That turn could not be played. Tap play to try it again.')
      setPlaying(false)
      setBusy(false)
    }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('error', onError)

    const cache = cacheRef.current
    return () => {
      aliveRef.current = false
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('error', onError)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
      cache.forEach((url) => URL.revokeObjectURL(url))
      cache.clear()
    }
  }, [start])

  // A different episode is a different recording: start again from its beginning.
  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    cacheRef.current.forEach((url) => URL.revokeObjectURL(url))
    cacheRef.current.clear()
    inflightRef.current.clear()
    savedRef.current = { index: -1, at: 0 }
    setPlaying(false)
    setBusy(false)
    setError('')
    setElapsed(0)
    setMeasured({})
    setIndex(0)
  }, [episode?.id])

  /**
   * Remember where the student is, at most once every ten seconds.
   *
   * The turn the episode opens on is deliberately not saved: opening an episode
   * must not overwrite the place it is about to offer to pick up from.
   */
  useEffect(() => {
    if (!episode?.id || index === savedRef.current.index) return
    const now = Date.now()
    const last = savedRef.current
    savedRef.current = { index, at: now }
    if (last.index === -1 || now - last.at >= SAVE_GAP_MS) callbacksRef.current.onSavePosition?.(index)
  }, [index, episode?.id])

  const pause = useCallback(() => {
    audioRef.current?.pause()
    setPlaying(false)
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playingRef.current) return pause()
    // Resuming a paused turn should not fetch it again.
    if (audio.src && audio.currentTime > 0) {
      audio.playbackRate = rateRef.current
      audio.play().catch(() => start(indexRef.current))
      return
    }
    return start(indexRef.current)
  }, [pause, start])

  const seekBy = useCallback(
    (delta) => {
      const audio = audioRef.current
      if (!audio) return
      const length = Number.isFinite(audio.duration) ? audio.duration : null
      // Past the end of this turn is the start of the next one.
      if (delta > 0 && length && audio.currentTime + delta >= length) return start(indexRef.current + 1)
      if (delta < 0 && audio.currentTime + delta < 0) {
        return indexRef.current > 0 ? start(indexRef.current - 1) : undefined
      }
      if (length) audio.currentTime = clamp(audio.currentTime + delta, 0, length)
      setElapsed(audio.currentTime)
      return undefined
    },
    [start],
  )

  const changeRate = useCallback((next) => {
    setRate(next)
    rateRef.current = next
    if (audioRef.current) audioRef.current.playbackRate = next
  }, [])

  /**
   * Save the whole episode as one MP3.
   *
   * The turns are already valid MPEG frames end to end (Edge speaks raw frames,
   * with no container around each turn), so they are simply joined in order.
   * Anything already played comes from the browser's cache, which is why a
   * second save costs no requests.
   */
  const save = useCallback(async () => {
    const current = episodeRef.current
    if (!current?.segments?.length || downloadingRef.current) return
    downloadingRef.current = true
    const count = current.segments.length
    setDownload({ done: 0, total: count })
    setError('')
    try {
      const parts = []
      for (let i = 0; i < count; i++) {
        const res = await fetchAudio(audioUrl(current.id, i))
        parts.push(await res.blob())
        if (aliveRef.current) setDownload({ done: i + 1, total: count })
      }
      const url = URL.createObjectURL(new Blob(parts, { type: 'audio/mpeg' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${slug(current.title)}.mp3`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (err) {
      if (aliveRef.current) setError(err.message || 'The episode could not be saved.')
    } finally {
      downloadingRef.current = false
      if (aliveRef.current) setDownload(null)
    }
  }, [])

  /** Seconds each turn takes: measured once it has played, estimated before. */
  const turnSeconds = useCallback(
    (i) => measured[i] ?? episode?.segments?.[i]?.seconds ?? 0,
    [measured, episode],
  )

  const timing = useMemo(() => {
    const totalSeconds = Array.from({ length: total }, (_, i) => turnSeconds(i)).reduce((a, b) => a + b, 0)
    const before = Array.from({ length: index }, (_, i) => turnSeconds(i)).reduce((a, b) => a + b, 0)
    return { totalSeconds, positionSeconds: before + elapsed, before, turnLength: turnSeconds(index) }
  }, [total, index, elapsed, turnSeconds])

  return {
    index,
    playing,
    busy,
    error,
    rate,
    download,
    elapsed,
    turnSeconds,
    ...timing,
    play: start,
    pause,
    toggle,
    next: () => start(index + 1),
    prev: () => start(index - 1),
    seekBy,
    setRate: changeRate,
    save,
  }
}

/** Turn a playback failure into a line the student can act on. */
function playFailure(err, setError) {
  if (err?.status === 503) {
    setError(err.message || 'Echo’s voice needs a few seconds. Tap play again.')
    return
  }
  if (err?.status === 401) {
    setError('Your session expired. Log in again to keep listening.')
    return
  }
  setError(err?.message || 'That turn could not be played. Tap play to try again.')
}
