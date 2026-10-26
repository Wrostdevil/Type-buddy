import { useEffect, useRef } from 'react'
import { PHOSPHOR, prefersReducedMotion } from './canvasUtil'

interface DialGaugeProps {
  /** current reading, 0..max */
  value: number
  max: number
  label: string
}

const RADIUS = 42
const CX = 50
const CY = 46

const paintDial = (
  g: CanvasRenderingContext2D,
  t: number,
  raw: number,
  label: string,
) => {
  g.fillStyle = PHOSPHOR.black
  g.fillRect(0, 0, 100, 92)

  // outer ring
  g.strokeStyle = 'rgba(57,255,111,0.35)'
  g.lineWidth = 1.5
  g.beginPath()
  g.arc(CX, CY, RADIUS, -Math.PI * 0.8, Math.PI * 0.8)
  g.stroke()

  // tick ring: 26 steps across 288°
  for (let i = 0; i <= 26; i++) {
    const a = -Math.PI * 0.8 + (i / 26) * Math.PI * 1.6
    const long = i % 5 === 0
    const r1 = RADIUS - (long ? 8 : 5)
    g.strokeStyle = long ? 'rgba(57,255,111,0.9)' : 'rgba(31,163,74,0.7)'
    g.lineWidth = long ? 1.6 : 1
    g.beginPath()
    g.moveTo(CX + Math.cos(a) * r1, CY + Math.sin(a) * r1)
    g.lineTo(CX + Math.cos(a) * RADIUS, CY + Math.sin(a) * RADIUS)
    g.stroke()
  }

  // arc fill up to the needle
  g.strokeStyle = 'rgba(57,255,111,0.22)'
  g.lineWidth = 3
  g.beginPath()
  g.arc(CX, CY, RADIUS - 12, -Math.PI * 0.8, -Math.PI * 0.8 + t * Math.PI * 1.6)
  g.stroke()

  // needle
  const a = -Math.PI * 0.8 + t * Math.PI * 1.6
  g.strokeStyle = PHOSPHOR.bright
  g.lineWidth = 2
  g.shadowColor = '#39ff6f99'
  g.shadowBlur = 6
  g.beginPath()
  g.moveTo(CX - Math.cos(a) * 10, CY - Math.sin(a) * 10)
  g.lineTo(CX + Math.cos(a) * (RADIUS - 8), CY + Math.sin(a) * (RADIUS - 8))
  g.stroke()
  g.shadowBlur = 0
  // pivot
  g.fillStyle = PHOSPHOR.mid
  g.beginPath()
  g.arc(CX, CY, 3.5, 0, Math.PI * 2)
  g.fill()

  // reading
  g.fillStyle = PHOSPHOR.bright
  g.font = 'bold 13px monospace'
  g.textAlign = 'center'
  g.fillText(`${Math.round(raw)}`, CX, CY + 26)
  g.fillStyle = 'rgba(95,169,124,0.9)'
  g.font = '8px monospace'
  g.fillText(label, CX, CY + 37)
  g.textAlign = 'left'
}

/**
 * Round phosphor dial: tick ring, smooth-chasing needle, reading burned
 * under the pivot like the reference gauges.
 */
export function DialGauge({ value, max, label }: DialGaugeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const valueRef = useRef({ value, max, label })

  // mirror the latest reading into the animation loop without redrawing
  useEffect(() => {
    valueRef.current = { value, max, label }
  }, [value, max, label])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const g = canvas.getContext('2d')
    if (!g) return
    canvas.width = 100
    canvas.height = 92

    let needle = 0
    const step = (dt: number) => {
      const { value: target, max: cap, label: tag } = valueRef.current
      needle += (target / cap - needle) * (target / cap > needle ? 0.055 : 0.16)
      const reading = target > 0.5 ? target * (1 - dt * 0.02) : target
      paintDial(g, needle, reading < 0 ? 0 : reading, tag)
    }

    if (prefersReducedMotion()) {
      paintDial(g, value / max, value, label)
      return
    }
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = now - last
      if (dt < 1000 / 24) return
      last = now
      step(dt / 1000)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="h-full w-full"
      style={{ imageRendering: 'auto' }}
    />
  )
}
