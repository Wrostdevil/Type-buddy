import { useEffect, useRef } from 'react'
import { PHOSPHOR, runCanvasLoop } from './canvasUtil'

/**
 * Segmented binary tape strip: columns of 0/1 that mutate a few cells at
 * a time, like the segmented "5·5·5·5" strips in the reference artwork.
 */
export function BinaryStrip({ seed, height = 22 }: { seed: number; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const g = canvas.getContext('2d')
    if (!g) return

    const COL_W = 5
    const ROW_H = 6
    let cols = 0
    let rows = 0
    let bits: Uint8Array = new Uint8Array(0)

    const build = () => {
      cols = Math.ceil(320 / COL_W) + 1
      rows = Math.ceil(height / ROW_H)
      bits = new Uint8Array(cols * rows)
      for (let i = 0; i < bits.length; i++) {
        // xorshift-ish deterministic start pattern varying with seed
        bits[i] = (((i + 1) * 7919 + seed * 13 + 101) >> 3) & 1
      }
    }
    build()

    const paint = (gg: CanvasRenderingContext2D, w: number, h: number, t: number) => {
      if (t <= 0.02) build()
      gg.fillStyle = PHOSPHOR.black
      gg.fillRect(0, 0, w, h)
      // mutate ~8% of cells each frame
      for (let i = 0; i < bits.length / 12; i++) {
        const k = Math.floor(Math.random() * bits.length)
        bits[k] = bits[k] ? 0 : 1
      }
      gg.font = '6px monospace'
      gg.textBaseline = 'top'
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const v = bits[r * cols + c]
          gg.fillStyle =
            (c + r + seed) % 17 === 0 ? PHOSPHOR.bright : 'rgba(31,163,74,0.75)'
          gg.fillText(v ? '1' : '0', c * COL_W, r * ROW_H + 1)
        }
        // segment gap every 12 columns
        if (c % 12 === 11) {
          gg.fillStyle = 'rgba(2,16,7,0.9)'
          gg.fillRect(c * COL_W + COL_W - 2, 0, 2, h)
        }
      }
      gg.fillStyle = 'rgba(1,6,2,0.35)'
      for (let y = 0; y < h; y += 3) gg.fillRect(0, y, w, 1)
    }

    return runCanvasLoop(canvas, paint, 9, { w: 320, h: height })
  }, [seed, height])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="block w-full"
      style={{ height, imageRendering: 'pixelated' }}
    />
  )
}
