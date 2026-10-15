import { computeStreak, levelInfo, materialProgress } from './stats.js'

// Each achievement reports progress as [current, target]. It unlocks when current >= target.
export const ACHIEVEMENTS = [
  {
    id: 'first-upload',
    title: 'First upload',
    text: 'Upload your own file or link.',
    progress: (s) => [s.activity.filter((a) => a.type === 'upload').length, 1],
  },
  {
    id: 'streak-3',
    title: 'Three days running',
    text: 'Study on three days in a row.',
    progress: (s) => [computeStreak(s.studyDays), 3],
  },
  {
    id: 'streak-7',
    title: 'A full week',
    text: 'Study on seven days in a row.',
    progress: (s) => [computeStreak(s.studyDays), 7],
  },
  {
    id: 'first-win',
    title: 'Monster slayer',
    text: 'Defeat a monster in the Quiz Arena.',
    progress: (s) => [s.quizLog.filter((q) => q.defeated).length, 1],
  },
  {
    id: 'cards-25',
    title: 'Memory builder',
    text: 'Mark 25 flashcards as easy.',
    progress: (s) => [Object.values(s.cardsEasy).reduce((n, ids) => n + ids.length, 0), 25],
  },
  {
    id: 'teach-80',
    title: 'Good teacher',
    text: 'Score 80% or more in Teach Echo.',
    progress: (s) => [Math.max(0, ...s.teachLog.map((t) => t.score)), 80],
  },
  {
    id: 'map-clear',
    title: 'Map cleared',
    text: 'Finish every topic of one course.',
    progress: (s) => {
      const best = Math.max(0, ...s.materials.map((m) => (m.pack?.sections?.length ? materialProgress(s, m).pct : 0)))
      return [best, 100]
    },
  },
  {
    id: 'xp-1000',
    title: '1,000 XP',
    text: 'Earn 1,000 XP in total.',
    progress: (s) => [s.xp, 1000],
  },
  {
    id: 'level-5',
    title: 'Level 5',
    text: 'Reach Explorer level 5.',
    progress: (s) => [levelInfo(s.xp).level, 5],
  },
]

export const isUnlocked = (a, state) => {
  const [cur, target] = a.progress(state)
  return cur >= target
}
