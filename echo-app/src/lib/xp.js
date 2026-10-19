// How much XP each action earns. Change the numbers here to rebalance the app.
export const XP = {
  upload: 15,
  topicDone: 20,
  quizCorrect: 10,
  quizWin: 20,
  cardEasy: 5,
  cardHard: 2,
  podcast: 20,
  teach: (score) => Math.round(score / 2),
}

/** A quiz answer given in under this many milliseconds counts as "fast" for the Speed stat. */
export const FAST_MS = 12000
