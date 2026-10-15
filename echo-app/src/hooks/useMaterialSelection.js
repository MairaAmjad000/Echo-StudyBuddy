import { useSearchParams } from 'react-router-dom'
import { useApp } from '../store/AppContext.jsx'
import { readyMaterials } from '../lib/stats.js'

/**
 * Keeps "which material / which section" in the URL (?material=...&section=...), so links
 * between Notes, Flashcards, Quiz and Teach Echo can jump straight to the right place.
 */
export default function useMaterialSelection() {
  const { state } = useApp()
  const [params, setParams] = useSearchParams()
  const ready = readyMaterials(state)

  const material =
    ready.find((m) => m.id === params.get('material')) ||
    ready.find((m) => m.id === state.lastStudied?.materialId) ||
    ready[0] ||
    null
  const section = material?.pack.sections.find((s) => s.id === params.get('section')) || null

  const update = (patch) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        for (const [k, v] of Object.entries(patch)) v ? next.set(k, v) : next.delete(k)
        return next
      },
      { replace: true },
    )

  return {
    ready,
    material,
    section,
    params,
    update,
    // One call, one patch: two updates in the same click would each build on
    // the params captured at render, so the second would undo the first.
    setMaterial: (id, patch = {}) => update({ material: id, section: null, ...patch }),
    setSection: (id) => update({ section: id }),
  }
}
