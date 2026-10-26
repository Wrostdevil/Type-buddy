import { useEffect, useMemo, useRef } from 'react'
import { mulberry32, PHOSPHOR, runCanvasLoop } from './canvasUtil'

type Pt = { x: number; y: number }
type Trace = { pts: Pt[]; len: number }
type Chip = { x: number; y: number; w: number; h: number }

interface Circuit {
  traces: Trace[]
  chips: Chip[]
  pads: Pt[]
  vias: Pt[]
}

/** Builds a believable PCB layer once per seed: manhattan traces + chips. */
function buildBoard(seed: number): Circuit {
  const rnd = mulberry32(seed * 7919 + 13)
  const W = 300
  const H = 170
  const pad = (n: number): number => Math.round(n / 10) * 10

  const occupied: Chip[] = []
  const chips: Chip[] = []
  const chipCount = 3 + ((seed % 3) | 0)
  for (let i = 0; i < chipCount; i++) {
    const w = pad(20 + rnd() * 30)
    const h = pad(14 + rnd() * 22)
    const x = pad(10 + rnd() * (W - w - 20))
    const y = pad(10 + rnd() * (H - h - 20))
    const chip = { x, y, w, h }
    if (occupied.some((c) => x < c.x + c.w + 8 && c.x < x + w + 8 && y < c.y + c.h + 8 && c.y < y + h + 8)) continue
    occupied.push(chip)
    chips.push(chip)
  }

  // routing: start from a chip pin pad, run manhattan segments to a destination
  const traces: Trace[] = []
  const pads: Pt[] = []
  const vias: Pt[] = []
  for (let i = 0; i < 16; i++) {
    const chip = chips[i % Math.max(1, chips.length)]
    const px = chip ? chip.x + (rnd() < 0.5 ? 0 : chip.w) : pad(rnd() * W)
    const py = chip ? chip.y + rnd() * chip.h : pad(rnd() * H)
    let pts: Pt[] = [{ x: px, y: py }]
    let x = px
    let y = py
    const steps = 2 + ((rnd() * 3) | 0)
    for (let s = 0; s < steps; s++) {
      const horiz = rnd() < 0.6
      const len = 16 + rnd() * 60
      x = horiz ? Math.max(0, Math.min(W, x + (rnd() < 0.5 ? len : -len))) : x
      y = horiz ? y : Math.max(0, Math.min(H, y + (rnd() < 0.5 ? len : -len)))
      pts.push({ x: pad(x), y: pad(y) })
    }
    const trace = { pts, len: 0 }
    trace.pts = trace.pts.filter(
      (p, idx) => idx === 0 || p.x !== trace.pts[idx - 1].x || p.y !== trace.pts[idx - 1].y,
    )
    traces.push(trace)
    pads.push(pts[0])
    if (rnd() < 0.4) vias.push(pts[pts.length - 1])
  }
  // endpoint pads too
  for (const tr of traces) {
    const last = tr.pts[tr.pts.length - 1]
    if (last) pads.push(last)
  }

  return { traces, chips, pads, vias }
}

const drawGlow = (g: CanvasRenderingContext2D, board: Circuit, pulses: number[]) => {
  const W = 300
  const H = 170
  g.fillStyle = PHOSPHOR.black
  g.fillRect(0, 0, W, H)

  // board substrate
  g.fillStyle = 'rgba(31,163,74,0.16)'
  g.fillRect(0, 0, W, H)
  g.strokeStyle = 'rgba(57,255,111,0.28)'
  g.strokeRect(4.5, 4.5, W - 9, H - 9)

  // static circuitry
  g.lineCap = 'round'
  for (const tr of board.traces) {
    g.strokeStyle = 'rgba(57,255,111,0.5)'
    g.lineWidth = 1.6
    g.beginPath()
    tr.pts.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)))
    g.stroke()
  }

  // chips with pin stubs
  for (const c of board.chips) {
    g.fillStyle = 'rgba(1,10,4,0.92)'
    g.fillRect(c.x, c.y, c.w, c.h)
    g.strokeStyle = 'rgba(57,255,111,0.75)'
    g.lineWidth = 1.2
    g.strokeRect(c.x + 0.5, c.y + 0.5, c.w, c.h)
    g.fillStyle = 'rgba(57,255,111,0.65)'
    for (let x = c.x; x < c.x + c.w; x += 6) {
      g.fillRect(x, c.y - 3, 2, 3)
      g.fillRect(x, c.y + c.h, 2, 3)
    }
    // die line
    g.strokeStyle = 'rgba(57,255,111,0.3)'
    g.strokeRect(c.x + c.w * 0.25, c.y + c.h * 0.2, c.w * 0.5, c.h * 0.6)
  }

  // pads + vias
  for (const p of board.pads) {
    g.fillStyle = 'rgba(57,255,111,0.8)'
    g.beginPath()
    g.arc(p.x, p.y, 2, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = PHOSPHOR.black
    g.beginPath()
    g.arc(p.x, p.y, 0.9, 0, Math.PI * 2)
    g.fill()
  }
  for (const v of board.vias) {
    g.strokeStyle = 'rgba(57,255,111,0.7)'
    g.lineWidth = 1
    g.beginPath()
    g.arc(v.x, v.y, 2.6, 0, Math.PI * 2)
    g.stroke()
  }

  // travelling signal pulses
  for (let i = 0; i < board.traces.length; i++) {
    const tr = board.traces[i]
    const p = pulses[i]
    const total = tr.pts.reduce((a, b, idx) => {
      if (idx === 0) return 0
      const prev = tr.pts[idx - 1]
      return a + Math.abs(b.x - prev.x) + Math.abs(b.y - prev.y)
    }, 0)
    if (total === 0) continue
    const d = (p % 1) * total
    let acc = 0
    for (let s = 1; s < tr.pts.length; s++) {
      const a0 = tr.pts[s - 1]
      const a1 = tr.pts[s]
      const seg = Math.abs(a1.x - a0.x) + Math.abs(a1.y - a0.y)
      if (acc + seg >= d) {
        const k = seg === 0 ? 0 : (d - acc) / seg
        const x = a0.x + (a1.x - a0.x) * k
        const y = a0.y + (a1.y - a0.y) * k
        g.fillStyle = PHOSPHOR.bright
        g.shadowColor = '#39ff6fcc'
        g.shadowBlur = 5
        g.beginPath()
        g.arc(x, y, 1.8, 0, Math.PI * 2)
        g.fill()
        g.shadowBlur = 0
        break
      }
      acc += seg
    }
  }
}

interface CircuitBoardProps {
  seed: number
}

const DB_ROWS = [12.7, 38.9, 22.4, 91.7, 47.9]

/**
 * PCB window with animated signal traffic and the dB meter column that
 * cycles readings — matching the lower strip of the reference dashboard.
 */
export function CircuitBoard({ seed }: CircuitBoardProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const board = useMemo(() => buildBoard(seed), [seed])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    return runCanvasLoop(
      canvas,
      (g, _w, _h, t) => {
        // one pulse per trace, per-lane varied speed
        const pulses = board.traces.map((_, i) => (t * (0.18 + ((i * 37) % 9) * 0.035) + i * 0.13) % 1)
        drawGlow(g, board, pulses)
      },
      13,
      { w: 300, h: 170 },
    )
  }, [board])

  return (
    <div className="flex h-full min-h-0 items-stretch gap-1 p-1">
      <div className="min-h-0 flex-1">
        <canvas
          ref={ref}
          aria-hidden
          className="block h-full w-full"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <div className="flex w-12 shrink-0 flex-col justify-around border-l border-terminal-border/60 pl-1 font-mono text-[8px] leading-tight text-terminal-text-dim">
        {DB_ROWS.map((db, i) => (
          <span key={i} className="whitespace-nowrap tabular-nums">
            {(db + ((seed * (i + 3)) % 7) * 0.4).toFixed(1)} dB
          </span>
        ))}
      </div>
    </div>
  )
}
