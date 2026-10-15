// Fills in believable progress so every page can be seen with data.
// Ported from the frontend's seed.js (Settings > Load sample progress).

const DAY = 864e5
const day = (n, now) => new Date(now - n * DAY).toLocaleDateString('en-CA')

export function demoProgress(materialId, now = Date.now()) {
  const xpLog = []
  const perDay = [90, 140, 60, 180, 110, 75, 160, 120, 95, 150, 70, 130, 100, 85, 170, 60, 140, 110, 90, 125, 80, 150]
  perDay.forEach((amount, i) => xpLog.push({ at: now - (i * 1.3 + 0.2) * DAY, amount }))
  xpLog.sort((a, b) => a.at - b.at)
  const xp = xpLog.reduce((n, e) => n + e.amount, 0)
  const at = (hoursAgo) => now - hoursAgo * 36e5
  return {
    sectionsDone: { [materialId]: ['s1', 's2', 's3'] },
    cardsEasy: { [materialId]: ['c1', 'c3', 'c4', 'c6', 'c7', 'c9', 'c10', 'c11', 'c12', 'c13', 'c15'] },
    quizLog: [
      { at: at(3), materialId, correct: 8, total: 10, defeated: false, fast: 5 },
      { at: at(30), materialId, correct: 6, total: 8, defeated: false, fast: 4 },
      { at: at(80), materialId, correct: 9, total: 10, defeated: true, fast: 7 },
    ],
    teachLog: [
      { at: at(26), materialId, sectionId: 's2', topic: 'TCP Connection Setup', score: 75 },
      { at: at(100), materialId, sectionId: 's3', topic: 'Transmission Media', score: 67 },
    ],
    xp,
    xpLog,
    studyDays: Array.from({ length: 14 }, (_, i) => day(13 - i, now)),
    activity: [
      { id: 'd1', type: 'quiz', text: 'Quiz completed. Score 80%', at: at(3) },
      { id: 'd2', type: 'teach', text: 'Teach Echo on TCP Connection Setup. Score 75%', at: at(26) },
      { id: 'd3', type: 'cards', text: 'Flashcards reviewed. 11 marked easy', at: at(28) },
      { id: 'd4', type: 'topic', text: 'Finished topic: Transmission Media', at: at(52) },
      { id: 'd5', type: 'upload', text: 'Notes generated from Data Communication', at: at(120) },
    ],
    lastStudied: { materialId, sectionId: 's4' },
  }
}
