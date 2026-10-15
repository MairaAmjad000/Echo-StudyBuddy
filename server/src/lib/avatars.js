// The profile pictures a user may set, mirroring the frontend's
// src/lib/avatars.js so both sides compute identical unlock levels.
// Change both together.

export const AVATAR_FILES = [
  '01_Mira.png',
  '02_Kai.png',
  '03_Luna.png',
  '04_Elliot.png',
  '05_Poppy.png',
  '06_Noah.png',
  '07_Sage.png',
  '08_Riven.png',
  '09_Nova.png',
  '10_Yuki.png',
  '11_Sunny.png',
  '12_Pip.png',
  '13_Iris.png',
  '14_Ren.png',
  '15_Mochi.png',
  '16_Ash.png',
  '17_Clover.png',
  '18_Leo.png',
]

/** The level at which the picture at `index` (0-based) unlocks. */
export const avatarUnlockLevel = (index) => (index < 3 ? 1 : 1 + 5 * (index - 2))

export const AVATARS = AVATAR_FILES.map((file, index) => ({
  id: file,
  name: file.replace(/^\d+_/, '').replace(/\.png$/, ''),
  unlockLevel: avatarUnlockLevel(index),
}))

/** The avatar with this id, or null when the id is not one of ours. */
export const avatarById = (id) => AVATARS.find((a) => a.id === id) || null
