import { useEffect, useRef } from 'react'
import { PHOSPHOR } from './canvasUtil'

/**
 * "Vector" window: a phosphor oscilloscope trace that idles as a soft sine
 * and, once the operator types, spikes into a jittering pulse train whose
 * amplitude tracks live WPM.
 */
export function KeyOsc({ wpm }: { wpm: number }) {
  const ampRef = useRef(0)
  useEffect(() => {
    ampRef.current = Math.min(1, wpm / 130)
  }, [wpm])

  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const g = canvas.getContext('2d')
    if (!g) return
    const W = 200
    const H = 110
    canvas.width = W
    canvas.height = H

    const paint = (t: number) => {
      g.fillStyle = PHOSPHOR.black
      g.fillRect(0, 0, W, H)

      // graticule
      g.strokeStyle = 'rgba(57,255,111,0.14)'
      g.lineWidth = 1
      g.beginPath()
      for (let x = 0; x <= W; x += 20) {
        g.moveTo(x + 0.5, 0)
        g.lineTo(x + 0.5, H)
      }
      for (let y = 0; y <= H; y += 14) {
        g.moveTo(0, y + 0.5)
        g.lineTo(W, y + 0.5)
      }
      g.stroke()

      // trace: pulse train amplitude scaled by typing intensity
      const ampVal = ampRef.current
      const amp = 0.12 + ampVal * 0.8
      const busy = ampVal > 0.05
      g.strokeStyle = PHOSPHOR.bright
      g.lineWidth = 1.5
      g.shadowColor = '#39ff6faa'
      g.shadowBlur = 4
      g.beginPath()
      const mid = H / 2
      for (let x = 0; x <= W; x++) {
        const p = x / W
        let y = mid
        if (busy) {
          y =
            mid -
            amp * H * 0.42 *
              (Math.sin(p * 26 - t * 9) * Math.exp(-((p - ((t * 0.7) % 1)) ** 2) * 18) +
                (Math.random() - 0.5) * 0.5 * amp)
        } else {
          y = mid - Math.sin(p * 7 + t * 2.2) * H * 0.12
        }
        if (x === 0) g.moveTo(x, y)
        else g.lineTo(x, y)
      }
      g.stroke()
      g.shadowBlur = 0

      // sweep marker + scanlines
      const sx = ((t / 3) % 1) * W
      g.fillStyle = 'rgba(57,255,111,0.08)'
      g.fillRect(sx, 0, 4, H)
      g.fillStyle = 'rgba(1,6,2,0.3)'
      for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1)
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paint(20)
      return
    }
    let raf = 0
    let last = 0
    const t0 = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 1000 / 26) return
      last = now
      paint((now - t0) / 1000)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="block h-full w-full"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
