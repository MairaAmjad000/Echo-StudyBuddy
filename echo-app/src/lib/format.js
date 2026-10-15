// Small helpers shared across the app.

export const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 9)}`

/** Local calendar day as YYYY-MM-DD (en-CA formats this way). */
export const dayKey = (d = new Date()) => new Date(d).toLocaleDateString('en-CA')

export const clamp = (n, min, max) => Math.min(max, Math.max(min, n))

export function timeAgo(ts, now = Date.now()) {
  const s = Math.max(0, (now - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
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

export const fileExt = (name = '') => (name.includes('.') ? name.split('.').pop().toLowerCase() : '')

export const stripExt = (name = '') => name.replace(/\.[^.]+$/, '')

export const typeLabel = (type) =>
  ({ pdf: 'PDF', pptx: 'PPTX', docx: 'DOCX', txt: 'TXT', md: 'MD', youtube: 'Video', sample: 'Sample' }[type] || 'File')

export const mmss = (seconds) => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
