import { useEffect, useRef } from 'react'
import { PHOSPHOR, runCanvasLoop } from './canvasUtil'

const CAM_W = 300
const CAM_H = 169 // matches the cam's aspect-video box

const timestamp = (t: number): string => {
  const d = new Date(Date.now() - 0) // real clock, drifting with scene time
  const s = d.getSeconds() + Math.floor(t)
  d.setSeconds(s)
  const pad = (n: number): string => `${n}`.padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * A fake surveillance feed: bright phosphor "ground", near-dark moving
 * subjects, sensor noise, scanlines and a glitch slice. Five procedural
 * scenes keyed by seed — pedestrian crossing, street canyon, two highway
 * angles and an intersection — all pure functions of time.
 */
function drawScene(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  seed: number,
) {
  // night-green ground with a darker horizon
  g.fillStyle = PHOSPHOR.faint
  g.fillRect(0, 0, w, h)
  const grd = g.createLinearGradient(0, 0, 0, h)
  grd.addColorStop(0, 'rgba(1,6,2,0.55)')
  grd.addColorStop(0.55, 'rgba(1,10,4,0.12)')
  grd.addColorStop(1, 'rgba(2,16,7,0.5)')
  g.fillStyle = grd
  g.fillRect(0, 0, w, h)

  const ground = '#287A45'
  const dark = '#04150B'
  const span = (v: number, m: number): number => ((v % m) + m) % m

  if (seed % 5 === 0) {
    // crosswalk crowd — silhouettes drift left, bob as they walk
    g.fillStyle = ground
    g.fillRect(0, h * 0.42, w, h * 0.58)
    for (let i = 0; i < 9; i++) {
      const off = (i * 53.7) % 1
      const x = span(off * w - t * (26 + (i % 3) * 9), w + 40) - 20
      const y = h * 0.5 + ((i * 17) % (h * 0.42))
      const s = 5 + (i % 4)
      g.fillStyle = dark
      g.fillRect(x, y, s * 1.4, s * 3.2) // torso
      g.fillRect(x + s * 0.2, y - s * 1.1, s * 0.9, s * 1.2) // head
      const bob = Math.abs(Math.sin(t * 6 + i)) * 1.4
      g.fillRect(x - s * 0.5, y + s * 3.2 - bob, s * 0.8, s * 1.4) // legs
    }
  } else if (seed % 5 === 1) {
    // street canyon — buildings flank a road, cars approach the camera
    g.fillStyle = ground
    g.fillRect(w * 0.3, h * 0.35, w * 0.4, h * 0.65)
    g.fillStyle = dark
    g.fillRect(0, 0, w * 0.3, h)
    g.fillRect(w * 0.7, 0, w * 0.3, h)
    g.fillStyle = PHOSPHOR.dim
    for (let by = 8; by < h - 10; by += 14) {
      for (let bx = 6; bx < w * 0.3 - 8; bx += 12) {
        if ((bx * 7 + by * 13) % 5 < 2) g.fillRect(bx, by, 4, 5)
      }
      for (let bx = 0; bx < w * 0.3 - 8; bx += 12) {
        if ((bx * 5 + by * 11) % 5 < 2) g.fillRect(w * 0.72 + bx, by, 4, 5)
      }
    }
    for (let i = 0; i < 3; i++) {
      const p = span(t * 0.22 + i * 0.34, 1)
      const cw = 8 + p * 34
      g.fillStyle = dark
      g.fillRect(w * 0.5 - cw / 2 + (i - 1) * 26, h * (0.36 + p * 0.6), cw, cw * 0.72)
    }
  } else if (seed % 5 === 2 || seed % 5 === 4) {
    // highway — overhead view, dashed median, traffic in both lanes
    g.fillStyle = ground
    g.fillRect(w * 0.36, 0, w * 0.28, h)
    g.fillStyle = dark
    for (let y = span(t * 22, 18) - 18; y < h; y += 18) {
      g.fillRect(w * 0.495, y, 3, 9)
    }
    for (let i = 0; i < 5; i++) {
      const p = span(t * (30 + i * 12) + i * 77, h + 30) - 15
      g.fillStyle = dark
      g.fillRect(w * (0.39 + i * 0.008), p, 9, 20)
      const q = span(60 - t * (24 + i * 9) + i * 55, h + 30) - 15
      g.fillRect(w * (0.55 + i * 0.009), q, 9, 20)
    }
    // shoulder trees
    g.fillStyle = PHOSPHOR.dim
    for (let i = 0; i < 12; i++) {
      g.fillRect(i * 27 + 5, span(i * 43, h) * 0.9, 5, 5)
    }
  } else {
    // intersection — cross traffic and a blinking light
    g.fillStyle = ground
    g.fillRect(0, h * 0.28, w, h * 0.44)
    g.fillRect(w * 0.3, 0, w * 0.4, h)
    for (let i = 0; i < 4; i++) {
      g.fillStyle = dark
      const x = span(t * 34 + i * 90, w + 50) - 25
      g.fillRect(x, h * 0.33 + i * 6, 20, 9)
      const y = span(t * 28 + i * 120, h + 50) - 25
      g.fillRect(w * 0.4 + i * 8, y, 9, 20)
    }
    if (Math.floor(t * 1.4) % 2 === 0) {
      g.fillStyle = PHOSPHOR.bright
      g.fillRect(w * 0.68, h * 0.2, 3, 3)
    }
  }

  // sensor speckle noise
  for (let i = 0; i < 130; i++) {
    g.fillStyle = i % 5 === 0 ? 'rgba(57,255,111,0.5)' : 'rgba(1,6,2,0.6)'
    g.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 1, 1)
  }
  // scanlines
  g.fillStyle = 'rgba(1,6,2,0.35)'
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1)
  // occasional horizontal glitch slice
  if (Math.random() < 0.06) {
    const y = (Math.random() * (h - 8)) | 0
    const slice = g.getImageData(0, y, w, 7)
    g.putImageData(slice, 3 + (Math.random() * 7) | 0, y)
  }
  // vignette
  const vig = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.85)
  vig.addColorStop(0, 'rgba(0,0,0,0)')
  vig.addColorStop(1, 'rgba(0,0,0,0.55)')
  g.fillStyle = vig
  g.fillRect(0, 0, w, h)
}

interface CctvFeedProps {
  seed: number
  camId: string
}

/**
 * Bare camera viewport (no window chrome — the wallpaper shows raw feeds
 * with an ID tile underneath). Paints the procedural scene + HUD text.
 */
export function CctvFeed({ seed, camId }: CctvFeedProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    return runCanvasLoop(
      canvas,
      (g, w, h, t) => {
        drawScene(g, w, h, t, seed)
        // HUD: cam id, clock, rec dot
        g.fillStyle = 'rgba(57,255,111,0.85)'
        g.font = '9px monospace'
        g.fillText(camId, 5, 11)
        g.fillText(timestamp(t), w - 52, 11)
        if (Math.floor(t * 2) % 2 === 0) {
          g.fillStyle = PHOSPHOR.bright
          g.fillRect(w - 60, 5, 4, 4)
        }
      },
      13,
      { w: CAM_W, h: CAM_H },
    )
  }, [seed, camId])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="block h-full w-full"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
