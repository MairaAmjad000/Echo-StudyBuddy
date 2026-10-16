// The light/dark choice, kept on <html> and in localStorage only — it is a
// display preference, not account data, so it never goes to the server. The
// same key is read by an inline script in index.html, which applies the class
// before first paint so a reload in dark mode never flashes light.

const KEY = 'echo.theme'

export function currentTheme() {
  // The class on <html> is what the student is actually looking at, so the icon
  // always matches the page. The stored value is only what the next page load
  // starts from (the inline script in index.html applies it before first paint).
  if (typeof document !== 'undefined') return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function setTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* storage blocked — the theme simply lasts this page only */
  }
}

/** Switches and returns the theme now showing. */
export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}
