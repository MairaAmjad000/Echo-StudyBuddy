// Text to speech for the podcast, using Microsoft Edge's own "Read Aloud"
// voices through msedge-tts. They are the neural voices Edge reads pages with:
// no API key, no account and no per-character bill, which is why Echo can speak
// a full episode for free.
//
// Two properties of that service shape this file.
//
//   * Connecting is the slow, rate-limited part. A handshake costs about a
//     second and Microsoft answers a second handshake straight after the first
//     with HTTP 429, while each turn of speech costs 0.3-0.7s once a socket is
//     open. So one connection per voice is kept open and reused, and the
//     requests that share it are queued one behind another.
//   * It is somebody else's free service: it can rate-limit us, drop the socket
//     or reject the handshake at any moment. Every synthesis is therefore
//     retried once on a fresh connection, and a failure that survives the retry
//     is marked `unavailable` so the route can answer 503 and let the student
//     try again instead of showing them a server error.

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

/** The streaming MP3 Edge speaks in. Raw frames, no container, so turns can be
 * played back to back and even concatenated into one file. */
const FORMAT = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3

/** One turn of the script; longer than this is cut at a sentence boundary. */
export const MAX_TURN_CHARS = 700

/** A connection is dropped after this long without a request, so a server that
 * only serves a podcast now and then does not sit on an idle socket. */
const IDLE_CLOSE_MS = 3 * 60_000

/** ...and after this many turns, before a socket can go stale. */
const MAX_REQUESTS_PER_CONNECTION = 150

/** How long to wait before retrying on a fresh connection. */
const RETRY_WAIT_MS = 900

// A single turn must fit inside the host's 60s function ceiling (see
// server/vercel.json) together with its retry, so these stay small: one turn is
// at most MAX_TURN_CHARS of speech, which a healthy socket returns in a second.
const CONNECT_TIMEOUT_MS = 12_000
const SYNTH_TIMEOUT_MS = 20_000

/**
 * The voice pairs a podcast can be recorded with. Two hosts read every episode:
 * Echo, who explains, and Milo, who asks what a student would ask. Only the
 * accents and character change between presets — never which host is which.
 */
export const VOICE_PRESETS = [
  {
    id: 'studio',
    label: 'Studio — warm US voices',
    hosts: {
      echo: { name: 'Echo', voice: 'en-US-AvaNeural' },
      milo: { name: 'Milo', voice: 'en-US-AndrewNeural' },
    },
  },
  {
    id: 'bright',
    label: 'Bright — lively US voices',
    hosts: {
      echo: { name: 'Echo', voice: 'en-US-EmmaNeural' },
      milo: { name: 'Milo', voice: 'en-US-BrianNeural' },
    },
  },
  {
    id: 'british',
    label: 'British — London voices',
    hosts: {
      echo: { name: 'Echo', voice: 'en-GB-SoniaNeural' },
      milo: { name: 'Milo', voice: 'en-GB-RyanNeural' },
    },
  },
  {
    id: 'australian',
    label: 'Australian — Sydney voices',
    hosts: {
      echo: { name: 'Echo', voice: 'en-AU-NatashaNeural' },
      milo: { name: 'Milo', voice: 'en-AU-WilliamMultilingualNeural' },
    },
  },
]

export const DEFAULT_PRESET = VOICE_PRESETS[0].id

export const presetById = (id) => VOICE_PRESETS.find((p) => p.id === id) || VOICE_PRESETS[0]

/** Every voice this app may ask for. Anything else is refused, so a stored
 * voice can never be turned into arbitrary SSML content. */
const ALLOWED_VOICES = new Set(VOICE_PRESETS.flatMap((p) => [p.hosts.echo.voice, p.hosts.milo.voice]))

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** An error the route can turn into "the voice needs a moment, try again". */
const unavailable = (message, cause) => {
  const err = new Error(message)
  err.unavailable = true
  if (cause) err.cause = cause
  return err
}

/**
 * Make a script line safe to speak and safe to send.
 *
 * Two jobs in one pass: strip everything a reader would stumble over (markdown
 * marks, bullets, arrows, bracketed citations, page references left behind by
 * the PDF parser) and turn the few symbols that do carry meaning into the words
 * the voice should say.
 *
 * The escaping matters for more than tidiness: msedge-tts drops the text
 * straight into an SSML document, so a stray "<" from a formula would produce
 * invalid markup and the synthesis would fail.
 */
export function speakable(text) {
  let out = String(text ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ') // control characters
    .replace(/[*_`#>|]+/g, ' ')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s*[\u2013\u2014\u2212]\s*/g, ', ')
    .replace(/\u2026/g, '...')
    .replace(/[•◦▪·→←↔⇒√✓✗]/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/\bvs\.?\b/gi, 'versus')
    .replace(/\be\.g\.\b/gi, 'for example')
    .replace(/\bi\.e\.\b/gi, 'that is')
    .replace(/\betc\./gi, 'and so on.')
    .replace(/\s*\[\s*\d+(?:\s*[,\-\u2013]\s*\d+)*\s*\]/g, ' ') // [12], [3, 4]
    .replace(/\s*\((?:see|cf|p|pp|fig|figure|eq|eqn|table)\.?\s*\d+[^)]*\)/gi, ' ')
    .replace(/\((?:[^()]{0,24})\)/g, (m) => (/^\((?:source|image|photo|figure)/i.test(m) ? ' ' : m))
    .replace(/\s*\|\s*/g, ', ')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/(?<=\s)[-]{2,}(?=\s)/g, ', ') // a stray " -- " from slide text
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])(?=[A-Za-z])/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (out.length > MAX_TURN_CHARS) {
    const cut = out.slice(0, MAX_TURN_CHARS)
    const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
    out = stop > MAX_TURN_CHARS * 0.5 ? cut.slice(0, stop + 1) : `${cut.replace(/\s+\S*$/, '')}.`
  }

  return escapeXml(out)
}

/** XML-escape the text the library will place inside its SSML template. */
const escapeXml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/**
 * One connection per voice, shared by every request in this process.
 * `queue` serialises the requests: the socket can carry several syntheses at
 * once, but turns arrive faster and more predictably when they are sent one at
 * a time, and a failure never leaves a half-written turn behind.
 */
const pool = new Map()

function entryFor(voice) {
  let entry = pool.get(voice)
  if (!entry) {
    entry = { client: null, requests: 0, idleTimer: null, queue: Promise.resolve(), pending: 0 }
    pool.set(voice, entry)
  }
  return entry
}

/** Everything on this voice runs in order, and a failure never breaks the chain.
 * `pending` counts queued plus running turns, so the idle close knows the
 * difference between a quiet socket and one that is about to be used again. */
function run(entry, task) {
  entry.pending++
  const work = async () => {
    try {
      return await task()
    } finally {
      entry.pending--
    }
  }
  const next = entry.queue.then(work, work)
  entry.queue = next.catch(() => {})
  return next
}

/** Throw the socket away but keep the entry: a queued turn for this voice must
 * reconnect on the same entry, or two connections would be opened at once and
 * Edge would answer the second one with 429. */
function dropEntry(entry) {
  clearTimeout(entry.idleTimer)
  entry.idleTimer = null
  const client = entry.client
  entry.client = null
  entry.requests = 0
  if (!client) return
  try {
    client.close()
  } catch {
    /* already gone */
  }
}

/** Keep a warm socket for the next turn, then let it go when the page has gone quiet. */
function scheduleIdleClose(entry, voice) {
  clearTimeout(entry.idleTimer)
  entry.idleTimer = setTimeout(() => {
    if (entry.pending > 0) {
      scheduleIdleClose(entry, voice)
      return
    }
    dropEntry(entry)
  }, IDLE_CLOSE_MS)
  // A podcast must never keep the process alive on its own.
  entry.idleTimer.unref?.()
}

async function connect(entry, voice) {
  if (entry.client && entry.requests < MAX_REQUESTS_PER_CONNECTION) return entry.client
  if (entry.client) dropEntry(entry)

  const client = new MsEdgeTTS({ connectionTimeoutMs: CONNECT_TIMEOUT_MS, synthesisTimeoutMs: SYNTH_TIMEOUT_MS })
  try {
    await client.setMetadata(voice, FORMAT)
  } catch (err) {
    try {
      client.close()
    } catch {
      /* nothing to close */
    }
    throw unavailable(`Edge TTS refused the connection for ${voice}`, err)
  }
  entry.client = client
  entry.requests = 0
  return client
}

async function synthOnce(entry, voice, text) {
  const client = await connect(entry, voice)
  const { audioStream } = client.toStream(text)
  const chunks = []
  // A synthesis timeout or a dropped socket surfaces here as a stream error,
  // which is exactly what the retry below is for. The library's own timeout
  // covers the metadata handshake, not a stalled stream, so the bytes are read
  // against a wall clock as well — otherwise a silent socket could hold the
  // request until the host killed the whole function.
  let timer
  const stall = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(unavailable(`Edge TTS stalled while reading the audio for ${voice}`)),
      SYNTH_TIMEOUT_MS,
    )
    timer.unref?.()
  })
  try {
    await Promise.race([
      (async () => {
        for await (const chunk of audioStream) chunks.push(chunk)
      })(),
      stall,
    ])
  } finally {
    clearTimeout(timer)
  }
  const audio = Buffer.concat(chunks)
  if (!audio.length) throw unavailable(`Edge TTS sent no audio for ${voice}`)
  entry.requests++
  return audio
}

/**
 * Speak one turn and return the MP3 bytes.
 *
 * `voice` must be one of the voices in VOICE_PRESETS; anything else throws.
 * Rejects with an error carrying `unavailable = true` when Edge TTS will not
 * talk to us — the caller decides how to say that to the student.
 */
export async function synthesize({ voice, text }) {
  if (!ALLOWED_VOICES.has(voice)) throw new Error(`Unknown voice: ${voice}`)
  const spoken = speakable(text)
  if (!spoken) throw new Error('Nothing to speak')

  const entry = entryFor(voice)
  return run(entry, async () => {
    try {
      const audio = await synthOnce(entry, voice, spoken)
      scheduleIdleClose(entry, voice)
      return audio
    } catch (first) {
      // Almost every failure so far has been the connection rather than the
      // text, so throw the socket away and try once more on a fresh one.
      console.warn(`Edge TTS turn failed for ${voice} (${first.message}); retrying on a new connection`)
      dropEntry(entry)
      await delay(RETRY_WAIT_MS)
      try {
        const audio = await synthOnce(entry, voice, spoken)
        scheduleIdleClose(entry, voice)
        return audio
      } catch (second) {
        dropEntry(entry)
        throw unavailable('Edge TTS is not responding right now', second)
      }
    }
  })
}
