// Echo's story engine: turns the study state into a line to say and an
// expression to say it with. Every scenario returns
//   { key, pose, line, tone, ms }
// where `pose` is a raw Echo animation name (see strobi.avatar.ts) and
// `tone` picks the note colour: info | success | warn | error.
//
// The companion fires a story when its `key` changes, so a scenario speaks
// once — not on every re-render. Scenarios with several written variants use
// pickLine(), which avoids repeating the variant just said.
//
// Echo is the study friend who lives in this site: he knows your streak, your
// XP, your level, your topic titles and what time it is, and he says one short
// line about it. The full catalogue lives in docs/echo-dialogue.md.

import { dayKey } from '../../lib/format.js'

const DAY = 864e5

// Last variant shown per story key, so a rotating line never repeats itself.
const said = new Map()

/**
 * Choose a variant, avoiding the one shown last time for this key. `avoid`
 * lets a caller pass a line remembered from a previous page load (the module
 * store is empty then), so a fresh visit still gets something different.
 */
export function pickLine(key, variants, avoid) {
  const last = said.has(key) ? said.get(key) : avoid
  const pool = variants.length > 1 ? variants.filter((v) => v !== last) : variants
  const line = pool[Math.floor(Math.random() * pool.length)]
  said.set(key, line)
  return line
}

/** Length of the most recent unbroken run of study days. */
function lastRun(days) {
  const set = new Set(days)
  if (!set.size) return 0
  const latest = [...set].sort().reverse()[0]
  let n = 0
  const d = new Date(`${latest}T00:00:00`)
  while (set.has(dayKey(d))) {
    n += 1
    d.setDate(d.getDate() - 1)
  }
  return n
}

/**
 * The streak situation, as Echo would put it:
 *  - never studied        -> curiosity, an open door
 *  - run ended (missed)   -> a sad, personal nudge naming the lost run
 *  - alive but not today  -> gentle pressure before it slips
 *  - alive and studied    -> pride, scaled to the size of the run
 */
export function streakStory(studyDays, streak) {
  const studiedToday = new Set(studyDays).has(dayKey())

  if (!studyDays.length) {
    return {
      key: 'streak-new',
      pose: 'curious',
      line: 'No streak yet — study today and day one starts now.',
      tone: 'info',
      ms: 7000,
    }
  }

  if (streak === 0) {
    const run = lastRun(studyDays)
    const line =
      run >= 7
        ? `Your ${run}-day streak ended. That was a good run — one topic today starts the next one.`
        : run >= 3
          ? `Your ${run}-day streak slipped away. Study today and it starts again.`
          : 'Your streak is empty. Study today to get it moving again.'
    return { key: 'streak-missed', pose: 'sad', line, tone: 'warn', ms: 8000 }
  }

  if (!studiedToday) {
    return {
      key: 'streak-risk',
      pose: 'suspicious',
      line: `Your ${streak}-day streak is still alive, but only until midnight. Study today to keep it.`,
      tone: 'warn',
      ms: 8000,
    }
  }

  if (streak >= 30) {
    return {
      key: 'streak-month',
      pose: 'celebrate',
      line: pickLine('streak-month', [
        'A full month unbroken. I have nothing left to teach you about consistency.',
        '30 days straight. That is not motivation any more, that is routine.',
      ]),
      tone: 'success',
      ms: 8000,
    }
  }
  if (streak >= 14) {
    return {
      key: 'streak-fortnight',
      pose: 'proud',
      line: `Two weeks unbroken — ${streak} days. Keep going.`,
      tone: 'success',
      ms: 7000,
    }
  }
  if (streak >= 7) {
    return {
      key: 'streak-hot',
      pose: 'proud',
      line: pickLine('streak-hot', [`${streak} days in a row. You are on fire.`, `${streak} days straight. That is a habit now.`]),
      tone: 'success',
      ms: 7000,
    }
  }
  if (streak >= 3) return { key: 'streak-good', pose: 'happy', line: `Day ${streak} of the streak. Nice work.`, tone: 'success', ms: 7000 }
  if (streak === 2) {
    return {
      key: 'streak-two',
      pose: 'happy',
      line: 'Two days. Tomorrow makes it a real streak — I will be here.',
      tone: 'info',
      ms: 7000,
    }
  }
  return {
    key: 'streak-day',
    pose: 'happy',
    line: `Day ${streak} of your streak — study tomorrow to make it ${streak + 1}.`,
    tone: 'info',
    ms: 7000,
  }
}

/**
 * Where the current course stands, for the learning map:
 * fresh start, steady middle, nearly there, boss open, course cleared.
 */
export function courseStory({ prog, bossDone }) {
  if (!prog || !prog.total) return null
  const pct = prog.pct

  if (pct >= 100) {
    return bossDone
      ? {
          key: 'course-cleared',
          pose: 'celebrate',
          line: pickLine('course-cleared', [
            'Course cleared — boss defeated. Pick the next one.',
            'All topics done and the boss is down. That course is finished.',
            'Boss defeated. You took this whole course apart. Beautiful.',
          ]),
          tone: 'success',
          ms: 8000,
        }
      : {
          key: 'course-boss',
          pose: 'excited',
          line: pickLine('course-boss', [
            'Every topic done! The boss round is open — go finish it.',
            'The whole map is blue. Only the boss is left standing.',
            'No topics left — the boss is waiting. Ready?',
          ]),
          tone: 'success',
          ms: 8000,
        }
  }

  if (pct === 0) {
    return {
      key: 'course-start',
      pose: 'curious',
      line: pickLine('course-start', [
        'A whole course ahead. Pick the first topic and go.',
        'Fresh map, nothing marked yet. Start with the first stop.',
        'Nothing done yet — the first topic is the easiest place to begin.',
      ]),
      tone: 'info',
      ms: 7000,
    }
  }

  if (pct >= 60) {
    return {
      key: 'course-almost',
      pose: 'proud',
      line: pickLine('course-almost', [
        `${pct}% through — the end is in sight.`,
        `${pct}% done. The finish line is right there.`,
        `${pct}% — you are in the last stretch of this course.`,
      ]),
      tone: 'info',
      ms: 7000,
    }
  }

  if (pct >= 30) {
    return {
      key: 'course-mid',
      pose: 'working',
      line: pickLine('course-mid', [
        `${pct}% done. Steady pace, you have the hang of it.`,
        `${pct}% through. Halfway is close — keep the rhythm.`,
        `${pct}% done. This is the part where habits beat motivation.`,
      ]),
      tone: 'info',
      ms: 7000,
    }
  }

  return {
    key: 'course-early',
    pose: 'listening',
    line: pickLine('course-early', [
      `${pct}% done — the first topics are always the longest.`,
      `${pct}% in. Early days, but you have started — that is the hard bit.`,
      `${pct}% through. One stop at a time and this map fills up.`,
    ]),
    tone: 'info',
    ms: 7000,
  }
}

/**
 * The Smart Notes page, as Echo reads it: where the course stands and what to
 * do with the notes in front of you. Several written variants per situation,
 * rotated so he never repeats himself, and aware of the topic you have open.
 */
export function notesStory({ prog, sectionTitle }) {
  if (!prog || !prog.total) return null
  const pct = prog.pct

  if (pct >= 100) {
    return {
      key: 'notes-done',
      pose: 'proud',
      line: pickLine('notes-done', [
        'Every topic in these notes is marked done. Time to test it, not re-read it.',
        'All topics done. One last skim, then take the quiz.',
        'You have been through all of it — these notes have done their job.',
      ]),
      tone: 'success',
      ms: 7000,
    }
  }

  if (pct === 0) {
    return {
      key: 'notes-start',
      pose: 'curious',
      line: pickLine('notes-start', [
        'These are your notes for the whole course. Read the first topic, then mark it done.',
        'Nothing marked done yet — start at the top and take the summary first.',
        'Fresh notes, nothing ticked. One topic read properly beats a chapter skimmed.',
      ]),
      tone: 'info',
      ms: 7000,
    }
  }

  const lines = [
    `${pct}% marked done. Take the next unticked topic and read it properly.`,
    `${pct}% through the notes. Tick each topic as you finish it so the map stays honest.`,
    `${pct}% done. Notes reward a slow first read — go section by section.`,
  ]
  if (sectionTitle) lines.push(`You are on “${sectionTitle}”. Read it, then mark it done.`)
  return { key: 'notes-mid', pose: 'listening', line: pickLine('notes-mid', lines), tone: 'info', ms: 7000 }
}

/**
 * The first line of a visit, chosen from the clock, the gap since the last
 * visit and what is actually on the account. Returns null when the everyday
 * page stories below already say enough.
 */
export function arrivalStory({ state, streak, lastVisitAt, now = Date.now() }) {
  const hour = new Date(now).getHours()
  const signedIn = !!state.account
  const hasMaterials = state.materials.length > 0
  const daysAway = lastVisitAt ? Math.floor((now - lastVisitAt) / DAY) : null

  // Coming back after a long gap beats every other greeting.
  if (daysAway !== null && daysAway >= 7) {
    return {
      key: 'arrive-after-long',
      pose: 'sad',
      line: pickLine('arrive-after-long', [
        `It has been ${daysAway} days. Your notes are right where you left them.`,
        `${daysAway} days away — the streak is gone, the work is not. Start again whenever.`,
        // New line for very long absences
        `Welcome back! It's been forever since we last spoke.`,
      ]),
      tone: 'warn',
      ms: 8000,
    }
  }

  // Late night and after midnight: he is impressed and slightly worried.
  if (hour >= 21 || hour < 5) {
    return {
      key: 'arrive-late',
      pose: hour < 5 ? 'sleeping' : 'drowsy',
      line: pickLine('arrive-late', [
        `It is ${hour < 5 ? "past midnight" : "late"}. One short topic, then sleep.`,
        'What took you so long? I was starting to worry!',
        'Night study session. I will keep it quiet — one quiz, then bed.',
      ]),
      tone: 'info',
      ms: 8000,
    }
  }

  // A fresh day: greet once per session, not on every navigation.
  if (daysAway === null || daysAway >= 1) {
    if (!signedIn) {
      return {
        key: 'arrive-first',
        pose: 'curious',
        line: pickLine('arrive-first', [
          "Hey. I'm Echo. Give me one file and I will turn it into notes, cards and a quiz.",
          "New here? Drop your notes in and I will show you what I can do with them.",
        ]),
        tone: 'info',
        ms: 8000,
      }
    }
    if (!hasMaterials) {
      return {
        key: 'arrive-empty',
        pose: 'curious',
        line: 'Nothing here yet. One file in the drop zone and your first course appears.',
        tone: 'info',
        ms: 8000,
      }
    }
    if (hour < 11) {
      return {
        key: 'arrive-morning',
        pose: 'happy',
        line: pickLine('arrive-morning', [
          'Morning. One topic now counts double before the day gets busy.',
          'Good morning. Your streak starts again today.',
        ]),
        tone: 'info',
        ms: 7000,
      }
    }
    return {
      key: 'arrive-back',
      pose: 'happy',
      line: pickLine('arrive-back', [
        streak > 0 ? `You are back. ${streak}-day streak still warm.` : 'You are back. Today is a good day to start a streak.',
        // New line: welcome back
        'welcome backe',
        "Good to see you — today's mission is still waiting.",
      ]),
      tone: 'info',
      ms: 7000,
    }
  }

  return null // same-day return: the page stories have it covered
}

/**
 * The dashboard's friendly hello. Always warm, never a nag: it greets the
 * student and rotates through written variants so it never says the same
 * thing twice in a row. It still nods at the situation — a brand-new account,
 * a streak that needs today to survive, or a run worth celebrating.
 */
export function welcomeStory({ hasMaterials, streak, studyDays, avoid }) {
  const studiedToday = new Set(studyDays).has(dayKey())

  if (!hasMaterials) {
    return {
      key: 'welcome-new',
      pose: 'curious',
      line: pickLine('welcome-new', [
        "Welcome! Drop a file in and I'll turn it into notes, cards and a quiz.",
        "Hi, I'm Echo — lovely to meet you. Give me your notes and I'll do the rest.",
        "So glad you're here! Let's build your first course together.",
      ], avoid),
      tone: 'info',
      ms: 0,
    }
  }

  if (streak > 0 && !studiedToday) {
    return {
      key: 'welcome-keep',
      pose: 'happy',
      line: pickLine('welcome-keep', [
        `Welcome back! ${streak} days in a row — one topic today keeps it alive.`,
        `Good to see you! Let's protect that ${streak}-day streak today.`,
        `Hey again! A quick session now keeps your streak glowing.`,
      ], avoid),
      tone: 'info',
      ms: 0,
    }
  }

  if (streak >= 3) {
    return {
      key: 'welcome-streak',
      pose: 'happy',
      line: pickLine('welcome-streak', [
        `Welcome back! ${streak} days strong — you're on a roll.`,
        `So good to see you! ${streak} straight days and counting.`,
        `Hey, look at you — ${streak} days in a row. Let's keep going!`,
      ], avoid),
      tone: 'info',
      ms: 0,
    }
  }

  return {
    key: 'welcome-back',
    pose: 'happy',
    line: pickLine('welcome-back', [
      'Welcome back! Ready to pick up where you left off?',
      'Hey, good to see you! Shall we make today count?',
      "You're here — that's the hard part. Let's dive in!",
      'Nice to have you back. One small step today goes a long way.',
      'Great to see you again! What shall we learn today?',
    ], avoid),
    tone: 'info',
    ms: 0,
  }
}

/** How long Echo has been left alone on a tool page. */
export function idleStory(stage) {
  if (stage === 'bored') {
    return {
      key: 'idle-bored',
      pose: 'bored',
      line: pickLine('idle-bored', [
        'Still here? The next topic is one click away.',
        'I can wait all day. That is my whole thing.',
      ]),
      tone: 'info',
      ms: 6000,
    }
  }
  if (stage === 'drowsy') {
    return { key: 'idle-drowsy', pose: 'drowsy', line: 'I am going to nap. Wake me when you are ready.', tone: 'info', ms: 6000 }
  }
  return null
}

/** He noticed you came back after dozing off. */
export function wakeStory() {
  return { key: 'idle-wake', pose: 'waking', line: 'Oh — you are back. Where were we?', tone: 'info', ms: 5000 }
}

/** The level-up ladder. Every level celebrates; the milestones get their own words. */
export function levelStory(level) {
  const line =
    level === 2
      ? 'Level 2. The bar keeps moving — 500 XP each from here.'
      : level === 3
        ? 'Level 3. You are out of the tutorial phase.'
        : level === 5
          ? 'Level 5. Halfway to double digits.'
          : level === 10
            ? 'Level 10. That is a lot of showing up.'
            : `Level ${level}! New level, same mission.`
  return { key: `level-${level}`, pose: level >= 5 ? 'celebrate' : 'excited', line, tone: 'success', ms: 7000 }
}

/** XP milestones, checked when the total crosses one. */
export function xpStory(xp) {
  const milestones = [
    [100, 'happy', '100 XP. Small numbers, real work.'],
    [500, 'proud', "500 XP — that is a whole level's worth."],
    [1000, 'celebrate', '1,000 XP. A thousand small wins.'],
    [5000, 'celebrate', '5,000 XP. I would frame that if I had hands.'],
  ]
  const hit = milestones.filter(([n]) => xp >= n).pop()
  if (!hit || xp < hit[0] || xp - hit[0] >= 500) return null // only right after crossing
  return { key: `xp-${hit[0]}`, pose: hit[1], line: hit[2], tone: 'success', ms: 7000 }
}

/** One line per achievement, said when it unlocks. */
export const ACHIEVEMENT_LINES = {
  'first-upload': ['First upload! You gave me something to work with.', 'That is your first file in. Now it becomes a course.'],
  'streak-3': ['Three days in a row. That is a habit starting.', 'Three straight days. The streak is real now.'],
  'streak-7': ['Seven days. A whole week of you showing up.', 'A full week unbroken. That is worth saying out loud.'],
  'first-win': ['First monster down. There are bigger ones waiting.', 'Monster slayer. The arena is yours now.'],
  'cards-25': ['25 cards marked easy. Your memory has receipts now.', '25 easy cards. That is real recall, not luck.'],
  'teach-80': ['80%+ taught out loud. That is understanding, not memorising.', 'You explained it well enough to be marked a good teacher.'],
  'map-clear': ['Every topic in one course. The boss fears you now.', 'Map cleared — that was a whole course, start to finish.'],
  'xp-1000': ['1,000 XP. A thousand small wins.', 'Four figures of XP. It all added up.'],
  'level-5': ['Level 5. You are not a beginner at this any more.', 'Level 5 — the numbers are starting to look serious.'],
}

export function achievementStory(id) {
  const variants = ACHIEVEMENT_LINES[id]
  if (!variants) return { key: `ach-${id}`, pose: 'celebrate', line: 'Achievement unlocked.', tone: 'success', ms: 6000 }
  return { key: `ach-${id}`, pose: 'celebrate', line: pickLine(`ach-${id}`, variants), tone: 'success', ms: 6000 }
}

/** An achievement almost reached — worth a nudge, once per page visit. */
export function nearMissStory(locked) {
  if (!locked.length) return null
  const { title, cur, target } = locked[0]
  return {
    key: `near-${title}`,
    pose: 'proud',
    line: `${title} is at ${cur}/${target}. Almost there.`,
    tone: 'info',
    ms: 7000,
  }
}

/**
 * What the numbers say when the performance page opens: the weakest stat
 * first, then this month's trend, then the strongest. Several written variants
 * per situation, rotated so he never repeats himself.
 */
export function performanceStory({ xp, strongest, weakest, change }) {
  if (weakest) {
    return {
      key: `perf-${weakest.key}`,
      pose: 'curious',
      line: pickLine(`perf-weak-${weakest.key}`, [
        `${weakest.label} is your lowest at ${weakest.value}%. A few quizzes on that and it moves.`,
        `${weakest.label} is dragging at ${weakest.value}% — ${weakest.source.toLowerCase()} is the lever there.`,
        `Weakest spot: ${weakest.label} at ${weakest.value}%. Small, focused practice closes it fast.`,
      ]),
      tone: 'info',
      ms: 8000,
    }
  }
  if (change !== null && change > 0) {
    return {
      key: 'perf-up',
      pose: 'celebrate',
      line: pickLine('perf-up', [
        `+${change}% XP this month. Whatever you changed, keep it.`,
        `Up ${change}% on last month. The trend is heading the right way.`,
        `${change}% more XP than last month — that is momentum.`,
      ]),
      tone: 'success',
      ms: 7000,
    }
  }
  if (strongest) {
    return {
      key: `perf-${strongest.key}`,
      pose: 'proud',
      line: pickLine(`perf-strong-${strongest.key}`, [
        `${xp.toLocaleString()} XP total. ${strongest.label} is your strongest stat.`,
        `${strongest.label} leads at ${strongest.value}%. ${xp.toLocaleString()} XP earned in all.`,
        `Your edge is ${strongest.label} (${strongest.value}%). Everything else builds off it.`,
      ]),
      tone: 'info',
      ms: 7000,
    }
  }
  return {
    key: 'perf-new',
    pose: 'curious',
    line: pickLine('perf-new', [
      'Nothing to measure yet. One quiz and these numbers start moving.',
      'No stats on the board yet. Study a little and this page fills in.',
      'The chart is empty for now. Take a quiz and the first bar appears.',
    ]),
    tone: 'info',
    ms: 7000,
  }
}

/** Marking a topic done on the map or in the notes. */
export function topicDoneStory({ title, allDone }) {
  const line = allDone
    ? pickLine('topic-done-all', [
        'That is every topic. The boss round is open.',
        'Last topic done — the whole map is blue. Only the boss left.',
        'Every stop finished. Time to face the boss.',
      ])
    : pickLine('topic-done', [
        `“${title}” — done. One stop closer to the boss.`,
        `Topic done: ${title}. +20 XP, and the map moved.`,
        `${title}: ticked off. The trail just got a little longer.`,
      ])
  return { key: `topic-done-${title}-${allDone}`, pose: allDone ? 'excited' : 'proud', line, tone: 'success', ms: 6000 }
}

export function topicUndoneStory(title) {
  return {
    key: `topic-open-${title}`,
    pose: 'curious',
    line: pickLine('topic-open', [
      'Back open. Better to redo it than to bluff it.',
      'Reopened. No shame in a second pass.',
      'Marked not done — I would rather you be honest than rushed.',
    ]),
    tone: 'info',
    ms: 5000,
  }
}

/** The boss round opening line. */
export function bossIntroStory(monster, count) {
  return {
    key: 'boss-intro',
    pose: 'scared',
    line: pickLine('boss-intro', [
      `${monster}. ${count} questions from every topic. Steady.`,
      `${monster} is up. ${count} questions from the whole course — no rushing.`,
      `Boss fight: ${monster}, ${count} questions. Read each one twice.`,
    ]),
    tone: 'warn',
    ms: 7000,
  }
}

/**
 * The Quiz Arena, as Echo reads it: whether this course has been fought yet,
 * how far the course itself has gone, or whether the boss is up. The number
 * he quotes is the learning map's course progress, so every page speaks the
 * same percentage. Several written variants per situation, rotated so he
 * never repeats himself.
 */
export function quizStory({ prog, attempts, boss, sectionTitle }) {
  const where = sectionTitle ? `“${sectionTitle}”` : 'this course'
  if (!prog || !prog.total) return null

  if (boss) {
    return {
      key: 'quiz-boss',
      pose: 'scared',
      line: pickLine('quiz-boss', [
        'The boss round. Every topic, one fight — take it slowly.',
        'Boss time. Questions from the whole course, not just one topic.',
        'This is the boss. No timer, no rush — read each option.',
      ]),
      tone: 'warn',
      ms: 7000,
    }
  }

  if (!attempts) {
    return {
      key: 'quiz-first',
      pose: 'excited',
      line: pickLine('quiz-first', [
        `First fight on ${where}. Read all four options before you pick.`,
        'No rounds played yet. A wrong answer costs Echo 20 HP, so think first.',
        'New arena, fresh questions. You do not have to be fast, just right.',
      ]),
      tone: 'info',
      ms: 7000,
    }
  }

  // The learning map's course progress — the one number the whole app quotes.
  const pct = prog.pct

  if (pct >= 80) {
    return {
      key: 'quiz-strong',
      pose: 'proud',
      line: pickLine('quiz-strong', [
        `${pct}% of ${where} is behind you — only a little left.`,
        `${pct}% through this course. Almost at the boss.`,
        `${pct}% done. This course is nearly cleared.`,
      ]),
      tone: 'success',
      ms: 7000,
    }
  }

  if (pct >= 50) {
    return {
      key: 'quiz-ok',
      pose: 'listening',
      line: pickLine('quiz-ok', [
        `Around ${pct}% here. Reading the notes again will push that up.`,
        `${pct}% through this course — the map shows the rest.`,
        `${pct}% done. Work the open topics and this climbs fast.`,
      ]),
      tone: 'info',
      ms: 7000,
    }
  }

  return {
    key: 'quiz-shaky',
    pose: 'confused',
    line: pickLine('quiz-shaky', [
      `${pct}% so far. Read the notes for this topic, then come back swinging.`,
      `${pct}% of ${where} is marked done — start with the next stop.`,
      `${pct}% so far. The first topics are the quickest wins.`,
    ]),
    tone: 'warn',
    ms: 7000,
  }
}

/** One answer in the arena, right or wrong. */
export function battleHitStory(correct) {
  return correct
    ? {
        key: 'quiz-hit',
        pose: 'celebrate',
        line: pickLine('quiz-hit', ['Direct hit!', 'Clean hit — that landed.', 'Right answer. The monster felt that.']),
        tone: 'success',
        ms: 2600,
      }
    : {
        key: 'quiz-miss',
        pose: 'sad',
        line: pickLine('quiz-miss', ['Ouch, it hit back.', 'That one caught us.', 'Missed — the monster swings back.']),
        tone: 'error',
        ms: 2600,
      }
}

/** The end of a fight. */
export function battleOverStory({ defeated, killed, monsterName }) {
  if (defeated) {
    return {
      key: 'quiz-win',
      pose: 'excited',
      line: pickLine('quiz-win', [`${monsterName} is down. You did it!`, `${monsterName} defeated. Clean sweep.`, `That is ${monsterName} beaten. Well fought.`]),
      tone: 'success',
      ms: 6000,
    }
  }
  if (killed) {
    return {
      key: 'quiz-lost',
      pose: 'confused',
      line: pickLine('quiz-lost', ['It got me this time. Rematch?', 'That one went to the monster. Run it again?', 'Down for now — a second round usually flips it.']),
      tone: 'error',
      ms: 6000,
    }
  }
  return {
    key: 'quiz-close',
    pose: 'proud',
    line: pickLine('quiz-close', ['Close fight. Go again?', 'It barely survived. One more round?', 'So close — the rematch is right there.']),
    tone: 'info',
    ms: 6000,
  }
}

/**
 * The AI Flashcards page, as Echo reads it: how much of the deck has been
 * marked easy and what to do next. Several written variants per situation,
 * rotated so he never repeats himself, and aware of the topic in view.
 */
export function cardsStory({ prog, sectionTitle }) {
  if (!prog || !prog.total) return null
  const pct = prog.pct

  if (pct >= 100) {
    return {
      key: 'cards-known',
      pose: 'celebrate',
      line: pickLine('cards-known', [
        'Every card in this deck is marked easy. You own this one.',
        'Whole deck known. Take the quiz while it is fresh.',
        'All cards easy — this deck has nothing left to teach you.',
      ]),
      tone: 'success',
      ms: 7000,
    }
  }

  if (pct === 0) {
    return {
      key: 'cards-fresh',
      pose: 'thinking',
      line: pickLine('cards-fresh', [
        'Say the answer out loud before you flip. If you hesitated, mark it hard.',
        'No cards marked easy yet. Flip, answer out loud, then be honest about easy or hard.',
        'Fresh deck. The rule is simple: hesitate, and the card comes back.',
      ]),
      tone: 'info',
      ms: 7000,
    }
  }

  const lines = [
    `${prog.done} of ${prog.total} cards marked easy. Keep flipping.`,
    `${pct}% of this deck is easy now. The rest come back until they stick.`,
    `${pct}% easy. Hard cards returning is the deck working, not failing.`,
  ]
  if (sectionTitle) lines.push(`Still on “${sectionTitle}”. Flip it, then mark it easy or hard.`)
  return { key: 'cards-mid', pose: 'listening', line: pickLine('cards-mid', lines), tone: 'info', ms: 7000 }
}

/** Flashcards: the small moments of a deck. */
export function firstCardStory() {
  return {
    key: 'cards-first',
    pose: 'thinking',
    line: pickLine('cards-first', [
      'Say the answer out loud before you flip. If you hesitated, mark it hard.',
      'Answer out loud first, then flip. The cards only work if you are honest.',
      'Flip, check, and be strict: easy means instant, not “sort of”.',
    ]),
    tone: 'info',
    ms: 7000,
  }
}

export function easyStreakStory(left) {
  return { key: 'cards-streak', pose: 'happy', line: `Five easy in a row. ${left} card${left === 1 ? '' : 's'} left.`, tone: 'success', ms: 4000 }
}

export function allHardStory(total) {
  return {
    key: 'cards-allhard',
    pose: 'playful',
    line: `All ${total} cards came back. That is not a failure, that is a to-do list.`,
    tone: 'warn',
    ms: 6000,
  }
}

export function deckDoneStory({ easy, hard, xp }) {
  const line = hard ? `Deck cleared! ${easy} easy, ${hard} hard along the way. +${xp} XP.` : `Deck cleared! All ${easy} easy. +${xp} XP.`
  return { key: 'cards-done', pose: 'celebrate', line, tone: 'success', ms: 6000 }
}

/**
 * Teach Echo, as Echo reads it: whether this course has been taught yet, and
 * how far the course itself has gone. The number he quotes is the learning
 * map's course progress, so every page speaks the same percentage. Several
 * written variants per situation, rotated so he never repeats himself, aware
 * of the open topic.
 */
export function teachStory({ prog, attempts, sectionTitle }) {
  const topic = sectionTitle ? `“${sectionTitle}”` : 'this topic'
  if (!prog || !prog.total) return null

  if (!attempts) {
    return {
      key: 'teach-first',
      pose: 'curious',
      line: pickLine('teach-first', [
        `Teach me ${topic} in your own words. I will check it against your notes.`,
        `Nothing taught here yet. Explain ${topic} out loud — simply beats perfectly.`,
        `No explanations on this course so far. If you can say it clearly, you know it.`,
      ]),
      tone: 'info',
      ms: 7000,
    }
  }

  // The learning map's course progress — the one number the whole app quotes.
  const pct = prog.pct

  if (pct >= 80) {
    return {
      key: 'teach-strong',
      pose: 'proud',
      line: pickLine('teach-strong', [
        `${pct}% of this course is done — teaching your way across the map.`,
        `${pct}% through the course. When you can explain it, you own it.`,
        `${pct}% on the map. The end of this course is in sight.`,
      ]),
      tone: 'success',
      ms: 7000,
    }
  }

  if (pct >= 50) {
    return {
      key: 'teach-ok',
      pose: 'listening',
      line: pickLine('teach-ok', [
        `${pct}% done on this course. Explain the open topics to push it up.`,
        `${pct}% through — say the weak parts out loud, then mark them done.`,
        `Around ${pct}% here. Teaching your way from stop to stop.`,
      ]),
      tone: 'info',
      ms: 7000,
    }
  }

  return {
    key: 'teach-shaky',
    pose: 'confused',
    line: pickLine('teach-shaky', [
      `${pct}% done. Re-read ${topic} once, then teach it back to me.`,
      `${pct}% on this course. The notes first, the explanation second.`,
      `${pct}% so far — that is normal on a first pass. Read, then re-teach.`,
    ]),
    tone: 'warn',
    ms: 7000,
  }
}

/** While the recorder runs: he is listening. */
export function teachListeningStory() {
  return {
    key: 'teach-listening',
    pose: 'listening',
    line: pickLine('teach-listening', ["I am listening. Teach me!", 'Go ahead — I am all ears.', 'Recording. Explain it like I know nothing.']),
    tone: 'info',
    ms: 120000,
  }
}

/** Half a minute of silence during a recording. */
export function teachNudgeStory() {
  return {
    key: 'teach-nudge',
    pose: 'curious',
    line: pickLine('teach-nudge', ['Still there? Even two sentences count.', 'Take your time — start with what it is.', 'No rush. Say the first thing you remember.']),
    tone: 'info',
    ms: 6000,
  }
}

/** Teach Echo: what a score sounded like. */
export function teachScoreStory(score) {
  if (score === 100) {
    return {
      key: 'teach-100',
      pose: 'surprised',
      line: pickLine('teach-100', ['100%. Not one key point missed.', 'Full marks. You taught that perfectly.', '100% — nothing left to add.']),
      tone: 'success',
      ms: 6000,
    }
  }
  if (score >= 80) {
    return {
      key: 'teach-good',
      pose: 'celebrate',
      line: pickLine('teach-good', [`${score}%! Great teaching.`, `${score}% — that was clear and complete.`, `${score}%. You explained it well.`]),
      tone: 'success',
      ms: 5000,
    }
  }
  if (score >= 50) {
    return {
      key: 'teach-ok',
      pose: 'happy',
      line: pickLine('teach-ok', [
        `${score}%. Solid start — the missed points are listed below.`,
        `${score}%. Good bones; the gaps are listed under the result.`,
        `${score}%. Close — say the missed points again and it sticks.`,
      ]),
      tone: 'success',
      ms: 5000,
    }
  }
  return {
    key: 'teach-low',
    pose: 'confused',
    line: pickLine('teach-low', [
      `${score}%. Revise the missed bits and tell it back to me again.`,
      `${score}%. Read the notes for this topic, then teach it a second time.`,
      `${score}%. Not there yet — no shame, the missed points are listed.`,
    ]),
    tone: 'warn',
    ms: 6000,
  }
}

/** Chat errors, translated from the server's plain messages. */
export function chatErrorStory(message = '') {
  if (/quota/i.test(message)) return { key: 'chat-quota', pose: 'confused', line: "Echo's quota is used up for a minute. Ask again shortly.", tone: 'warn', ms: 6000 }
  if (/too long/i.test(message)) return { key: 'chat-timeout', pose: 'confused', line: 'That took too long. Shorter questions get faster answers.', tone: 'warn', ms: 6000 }
  return null
}

/** Leaving, resetting, and the quiet moments around them. */
export function signOutStory() {
  return { key: 'bye', pose: 'sad', line: 'See you tomorrow. I will keep your streak warm.', tone: 'info', ms: 6000 }
}

export function resetStory() {
  return { key: 'reset', pose: 'sad', line: 'Progress reset. Your notes are untouched — start fresh whenever.', tone: 'info', ms: 6000 }
}

export function deleteStory() {
  return { key: 'delete', pose: 'sad', line: 'Everything is gone. Thanks for letting me be part of it.', tone: 'warn', ms: 6000 }
}

export function motionStory(reduce) {
  return reduce
    ? { key: 'motion-off', pose: 'idle', line: 'Motion off. I will keep it calm.', tone: 'info', ms: 5000 }
    : { key: 'motion-on', pose: 'playful', line: 'Animations back. I missed stretching.', tone: 'info', ms: 5000 }
}
