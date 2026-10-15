// How much XP each action earns. Must stay in sync with the frontend's src/lib/xp.js.
export const XP = {
  upload: 15,
  topicDone: 20,
  quizCorrect: 10,
  quizWin: 20,
  cardEasy: 5,
  cardHard: 2,
  teach: (score) => Math.round(score / 2),
}

/** A quiz answer given in under this many milliseconds counts as "fast". */
export const FAST_MS = 12000

export const MIN_TEXT = 200 // shortest transcript we can build notes from
export const MAX_PACK_BYTES = 5 * 1024 * 1024 // request body cap for uploads
