import { useEffect } from 'react'

/**
 * Publishes the height an on-screen keyboard is covering as `--kb-inset` on
 * the document, so anything anchored to the bottom of the page can add it as
 * padding and stay above the keys.
 *
 * A phone keyboard shrinks the *visual* viewport; plenty of browsers leave the
 * layout viewport — and therefore `100dvh`, `position: sticky; bottom: 0` —
 * at its old height, which puts the chat composer under the keyboard. Reading
 * `visualViewport` covers those browsers whether or not the page asks for
 * `interactive-widget=resizes-content` (where the layout shrinks too, the
 * measurement comes out at zero and nothing is padded twice).
 */
export default function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport
    const root = document.documentElement
    if (!vv) return undefined

    const sync = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop
      // The address bar sliding away is a few dozen pixels of noise, not a
      // keyboard; only a real keyboard is worth pushing the composer up for.
      const inset = covered > 60 ? Math.round(covered) : 0
      if (inset) root.style.setProperty('--kb-inset', `${inset}px`)
      else root.style.removeProperty('--kb-inset')
    }

    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    window.addEventListener('resize', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
      root.style.removeProperty('--kb-inset')
    }
  }, [])
}
