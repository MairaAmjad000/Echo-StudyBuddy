// Small pure helpers shared by the server. Mirrors the frontend's src/lib/format.js.

export const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 9)}`

/** Local calendar day as YYYY-MM-DD. */
export const dayKey = (d = new Date()) => {
  const dt = new Date(d)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

export function timeAgo(ts, now = Date.now()) {
  const s = Math.max(0, (now - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 30 ? `${d}d ago` : new Date(ts).toLocaleDateString()
}

export function greeting(date = new Date()) {
  const h = date.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)

export const stripExt = (name = '') => name.replace(/\.[^.]+$/, '')
