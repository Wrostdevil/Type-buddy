/**
 * Shared plumbing for the dashboard's retro canvases. Every decorative
 * window paints low-res and lets CSS stretch it with `image-rendering:
 * pixelated` — cheap, chunky and very CRT.
 */

/** Deterministic PRNG so procedurally drawn windows are stable across renders. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Tuned palette used by all dashboard painters. */
export const PHOSPHOR = {
  bright: '#39FF6F',
  mid: '#1FA34A',
  dim: '#0E5B2B',
  faint: '#07361B',
  black: '#010602',
  panel: '#04140B',
}

/**
 * Runs `paint(context, width, height, tSeconds)` on a low-res canvas at a
 * fixed fps. When the user prefers reduced motion it paints a single warm
 * frame and stops instead. Returns an effect cleanup function.
 */
export function runCanvasLoop(
  canvas: HTMLCanvasElement,
  paint: (g: CanvasRenderingContext2D, w: number, h: number, t: number) => void,
  fps = 14,
  size?: { w: number; h: number },
): () => void {
  const g = canvas.getContext('2d')
  if (!g) return () => undefined

  const setLowRes = () => {
    // Low internal resolution on purpose: CSS stretches it to the box size.
    canvas.width = size?.w ?? 320
    canvas.height = size?.h ?? 220
  }

  let raf = 0
  let last = 0
  const start = performance.now()

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop)
    if (now - last < 1000 / fps) return
    last = now
    paint(g, canvas.width, canvas.height, (now - start) / 1000)
  }

  setLowRes()
  if (prefersReducedMotion()) {
    paint(g, canvas.width, canvas.height, 12)
    return () => undefined
  }
  raf = requestAnimationFrame(loop)
  return () => cancelAnimationFrame(raf)
}
