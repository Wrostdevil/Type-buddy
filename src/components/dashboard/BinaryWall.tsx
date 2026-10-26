import { useEffect, useRef } from 'react'
import { PHOSPHOR, runCanvasLoop } from './canvasUtil'

/**
 * Dense binary wall backing the breach console: a slow-mutating grid of
 * 0/1 with the occasional hot row — the centrepiece texture of the
 * reference dashboard, dialed low enough to keep word text readable.
 */
export function BinaryWall({ seed = 7 }: { seed?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const g = canvas.getContext('2d')
    if (!g) return

    const COL_W = 7
    const ROW_H = 9
    let cols = 0
    let rows = 0
    let bits: Uint8Array = new Uint8Array(0)
    let hotRow = -1

    const build = () => {
      cols = Math.ceil(320 / COL_W) + 1
      rows = Math.ceil(180 / ROW_H)
      bits = new Uint8Array(cols * rows)
      for (let i = 0; i < bits.length; i++) {
        bits[i] = (((i + 1) * 7919 + seed * 131 + 17) >> 5) & 1
      }
    }
    build()

    return runCanvasLoop(
      canvas,
      (gg, w, h, t) => {
        if (t <= 0.02) build()
        gg.fillStyle = PHOSPHOR.black
        gg.fillRect(0, 0, w, h)
        // mutate ~4% of cells per frame
        const cells = bits.length / 24
        for (let i = 0; i < cells; i++) {
          const k = Math.floor(Math.random() * bits.length)
          bits[k] = bits[k] ? 0 : 1
        }
        // one glowing row drifts through the wall
        hotRow = Math.floor(t * 0.35) % rows
        gg.font = '7px monospace'
        gg.textBaseline = 'top'
        for (let r = 0; r < rows; r++) {
          const isHot = r === hotRow
          for (let c = 0; c < cols; c++) {
            const v = bits[r * cols + c]
            gg.fillStyle = isHot
              ? 'rgba(57,255,111,0.55)'
              : v
                ? 'rgba(31,163,74,0.65)'
                : 'rgba(14,91,43,0.5)'
            gg.fillText(v ? '1' : '0', c * COL_W, r * ROW_H + 1)
          }
        }
      },
      10,
      { w: 320, h: 180 },
    )
  }, [seed])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="block h-full w-full"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
