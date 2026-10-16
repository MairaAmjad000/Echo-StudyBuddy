import { useState } from 'react'
import { currentTheme, toggleTheme } from '../../lib/theme.js'
import './ui.css'

// The two faces of the switch: the icon shows where it takes you — a moon from
// light mode, a sun from dark mode — and the label says the same in words.
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.4 14.6A8.4 8.4 0 0 1 9.4 3.6a8.5 8.5 0 1 0 11 11Z" />
  </svg>
)

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.6v2.4M12 19v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.6 12h2.4M19 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
  </svg>
)

/**
 * The light/dark switch: one round icon button, wherever it is placed. The
 * preference lives on <html> (see lib/theme.js), so one click restyles every
 * page and the choice survives a reload.
 */
export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(currentTheme)
  const toLight = theme === 'dark'
  const flip = () => setTheme(toggleTheme())

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={flip}
      title={toLight ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={toLight ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {toLight ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
