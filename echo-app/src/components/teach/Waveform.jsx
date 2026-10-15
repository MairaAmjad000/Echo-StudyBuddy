import { useEffect, useRef } from 'react'
import './teach.css'

/** Live microphone bars. With no analyser (not recording) it draws a flat resting line. */
export default function Waveform({ analyser, active }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    let raf

    const draw = () => {
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
      if (active && data) analyser.getByteFrequencyData(data)
      for (let i = 0; i < bars; i++) {
        let v = 0.05
        if (active && data) v = Math.max(0.05, data[Math.floor((i / bars) * data.length * 0.7)] / 255)
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
