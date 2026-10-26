import { useEffect, useRef } from 'react'
import { PHOSPHOR } from './canvasUtil'

type Pt = { x: number; y: number }

/** Landmark positions are expressed as fractions of the 1010x666 viewBox. */
const NODES: Pt[] = [
  { x: 0.245, y: 0.36 },
  { x: 0.14, y: 0.44 },
  { x: 0.19, y: 0.72 },
  { x: 0.31, y: 0.52 },
  { x: 0.53, y: 0.32 },
  { x: 0.6, y: 0.38 },
  { x: 0.66, y: 0.55 },
  { x: 0.75, y: 0.62 },
  { x: 0.79, y: 0.64 },
  { x: 0.9, y: 0.44 },
  { x: 0.845, y: 0.7 },
  { x: 0.5, y: 0.62 },
]

/**
 * The geo window: phosphor choropleth (bundled world.svg) plus a canvas
 * overlay throwing expanding target pings and fading trace arcs between
 * random relays — the classic "global intrusion" look.
 */
export function WorldMapWindow() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const g = canvas.getContext('2d')
    if (!g) return
    const VW = 300
    const VH = 198 // matches the 1010x666 aspect of the source map
    canvas.width = VW
    canvas.height = VH

    const paint = (t: number) => {
      g.clearRect(0, 0, VW, VH)
      const targetIdx = Math.floor(t * 0.7) % NODES.length
      const target = NODES[targetIdx]
      const px = target.x * VW
      const py = target.y * VH

      // fading trace arcs between random relays
      for (let k = 0; k < 4; k++) {
        const i = Math.floor(Math.random() * NODES.length)
        const j = Math.floor(Math.random() * NODES.length)
        const a = NODES[i]
        const b = NODES[j]
        const ph = (t * 0.42 + k * 0.29) % 1
        const fade = Math.sin(ph * Math.PI)
        const x1 = a.x * VW
        const y1 = a.y * VH
        const x2 = b.x * VW
        const y2 = b.y * VH
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.18 - 8
        g.strokeStyle = `rgba(57,255,111,${0.5 * fade})`
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(x1, y1)
        for (let s = 0; s <= ph; s += 0.05) {
          const q = s / Math.max(0.05, ph)
          const x = (1 - q) * (1 - q) * x1 + 2 * (1 - q) * q * mx + q * q * x2
          const y = (1 - q) * (1 - q) * y1 + 2 * (1 - q) * q * my + q * q * y2
          g.lineTo(x, y)
        }
        g.stroke()
      }

      // relay nodes
      for (const n of NODES) {
        const x = n.x * VW
        const y = n.y * VH
        g.fillStyle = PHOSPHOR.bright
        g.fillRect(x - 1, y - 1, 2, 2)
        g.strokeStyle = 'rgba(57,255,111,0.4)'
        g.lineWidth = 1
        g.strokeRect(x - 3.5, y - 3.5, 7, 7)
      }

      // expanding radar ping on the current target
      for (let ring = 0; ring < 3; ring++) {
        const ph = (t * 0.8 + ring / 3) % 1
        const r = 3 + ph * 16
        g.strokeStyle = `rgba(57,255,111,${(1 - ph) * 0.8})`
        g.lineWidth = 1.2
        g.beginPath()
        g.arc(px, py, r, 0, Math.PI * 2)
        g.stroke()
      }
      // crosshair
      g.strokeStyle = 'rgba(57,255,111,0.9)'
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(px - 6, py)
      g.lineTo(px + 6, py)
      g.moveTo(px, py - 6)
      g.lineTo(px, py + 6)
      g.stroke()

      // sensor static
      if (Math.random() < 0.35) {
        g.fillStyle = 'rgba(57,255,111,0.5)'
        g.fillRect((Math.random() * VW) | 0, (Math.random() * VH) | 0, 1, 1)
      }
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paint(30)
      return
    }
    let raf = 0
    let last = 0
    const t0 = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 1000 / 16) return
      last = now
      paint((now - t0) / 1000)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="relative h-full min-h-0 w-full">
      <img
        src="/world.svg"
        alt=""
        aria-hidden
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
      <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full" />
    </div>
  )
}
