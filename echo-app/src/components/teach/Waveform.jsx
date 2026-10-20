import { useEffect, useRef } from 'react'
import './teach.css'

/**
 * Live microphone bars. With an analyser it draws the real level; without one
 * — a phone, where the speech service holds the microphone — it breathes in a
 * steady rhythm so the panel still reads as "listening" instead of dead. Not
 * recording, it rests on a flat line.
 */
export default function Waveform({ analyser, active }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    if (active && data) analyser.getByteFrequencyData(data)
    let raf

    const draw = (time = performance.now()) => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = getComputedStyle(canvas).color
      const bars = Math.floor(w / 6)
      const t = time / 1000
      if (active && data) analyser.getByteFrequencyData(data)
      for (let i = 0; i < bars; i++) {
        let v = 0.05
        if (active && data) {
          v = Math.max(0.05, data[Math.floor((i / bars) * data.length * 0.7)] / 255)
        } else if (active) {
          // A calm standing wave: two slow, mismatched periods plus a centre
          // bias, so it looks like a voice rather than a loading spinner.
          const centre = 1 - Math.abs(i / bars - 0.5) * 1.4
          v = 0.1 + 0.34 * Math.max(0, centre) * (0.55 + 0.45 * Math.abs(Math.sin(t * 2.2 + i * 0.42)))
        }
        const bh = Math.max(3, v * h)
        ctx.fillRect(i * 6, (h - bh) / 2, 3, bh)
      }
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [analyser, active])

  return <canvas ref={ref} className="waveform" role="img" aria-label={active ? 'Microphone level' : 'Microphone is off'} />
}
