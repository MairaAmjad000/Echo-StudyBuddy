// Map friendly event names (the old mascot API) onto Echo's real
// animation library in src/strobi-avatar/strobi.avatar.ts, so pages can call
// `react('cheerful', ...)` or pass an animation name directly.
export const POSE_EVENTS = {
  // emotions
  cheerful: 'happy',
  happy: 'happy',
  veryhappy: 'excited',
  celebrate: 'celebrate',
  celebrating: 'celebrate',
  excited: 'excited',
  jump: 'excited',
  laugh: 'laughing',
  proud: 'proud',
  playful: 'playful',
  winking: 'playful',
  shy: 'shy',
  sad: 'sad',
  angry: 'angry',
  scary: 'scared',
  surprised: 'surprised',
  puzzled: 'confused',
  confused: 'confused',
  suspicious: 'suspicious',
  bored: 'bored',
  drowsy: 'drowsy',
  sleepy: 'sleeping',
  scared: 'scared',
  laughing: 'laughing',
  waving: 'curious',

  // activities
  study: 'listening',
  watching: 'listening',
  reading: 'listening',
  listening: 'listening',
  thinking: 'thinking',
  curious: 'curious',
  searching: 'searching',
  working: 'working',
  busy: 'working',
  idle: 'idle',
  awaiting: 'idle',
}
