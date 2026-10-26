import { useCallback, useEffect, useRef, useState } from 'react'
import { playKeySound } from '../../lib/sound'

type Phase = 'menu' | 'running' | 'over'

interface Drop {
  id: number
  ch: string
  x: number
  y: number
  vy: number
  dead: number
}

const W = 920
const H = 420
const GROUND = H - 26
const LIVES_MAX = 3

const BASE_KEYS = 'abcdefghijklmnopqrstuvwxyz'.split('')

/** spells out the pool a level draws from — caps and digits join later */
function poolFor(level: number): string[] {
  if (level >= 5) return [...BASE_KEYS, ...'0123456789'.split('')]
  if (level >= 3) return [...BASE_KEYS, ...'AEIOU'.split('')]
  return BASE_KEYS
}

/**
 * LETTER STORM — glyphs rain down at ever-increasing speed. Strike them
 * out of the sky one keystroke at a time; every landing burns hull and
 * kills the combo. Caps and digits join the storm as levels rise.
 */
export function Storm({ onScore }: { onScore: (score: number) => void }) {
  const [phase, setPhase] = useState<Phase>('menu')
  const [final, setFinal] = useState<{ score: number; bestCombo: number; wpm: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const g = useRef({
    drops: [] as Drop[],
    score: 0,
    combo: 0,
    bestCombo: 0,
    lives: LIVES_MAX,
    startedAt: 0,
    spawnAt: 0,
    nextId: 1,
    typedChars: 0,
    wpm: 0,
    level: 1,
    flash: 0,
  })

  const start = useCallback(() => {
    const st = g.current
    st.drops = []
    st.score = 0
    st.combo = 0
    st.bestCombo = 0
    st.lives = LIVES_MAX
    st.startedAt = performance.now()
    st.spawnAt = 0
    st.typedChars = 0
    st.wpm = 0
    st.level = 1
    st.flash = 0
    setPhase('running')
  }, [])

  // while live, the game owns the keyboard
  useEffect(() => {
    if (phase !== 'running') return
    document.body.dataset.gameCapture = '1'
    return () => {
      delete document.body.dataset.gameCapture
    }
  }, [phase])

  // run loop
  useEffect(() => {
    if (phase !== 'running') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = W
    canvas.height = H
    let raf = 0
    let last = performance.now()

    const paint = (dt: number, t: number) => {
      const st = g.current
      const elapsed = (t - st.startedAt) / 1000
      st.level = 1 + Math.floor(elapsed / 14)

      const spawnEvery = Math.max(0.55, 1.7 - st.level * 0.13)
      const concurrent = Math.min(7, 2 + st.level)
      if ((elapsed - st.spawnAt >= spawnEvery || st.drops.length === 0) && st.drops.filter((d) => d.dead < 0).length < concurrent) {
        st.spawnAt = elapsed
        const pool = poolFor(st.level)
        st.drops.push({
          id: st.nextId++,
          ch: pool[(Math.random() * pool.length) | 0],
          x: 24 + Math.random() * (W - 60),
          y: -8,
          vy: 30 + st.level * 7 + Math.random() * 14,
          dead: -1,
        })
      }

      for (const d of st.drops) {
        if (d.dead >= 0) {
          d.dead += dt
          continue
        }
        d.y += d.vy * dt
        if (d.y > GROUND) {
          d.dead = 0
          st.lives -= 1
          st.combo = 0
          st.flash = 0.5
          playKeySound({ kind: 'space', correct: false })
        }
      }
      st.drops = st.drops.filter((d) => d.dead < 0.7)
      if (elapsed > 1) {
        st.wpm = Math.max(0, Math.round(st.typedChars / 5 / (elapsed / 60)))
      }

      // ── draw ──
      ctx.fillStyle = '#010602'
      ctx.fillRect(-6, -6, W + 12, H + 12)
      // rain streaks
      ctx.strokeStyle = 'rgba(57,255,111,0.08)'
      for (let i = 0; i < 26; i++) {
        const sx = (i * 137 + t / 48) % W
        const sy = (i * 71 + t / 34) % GROUND
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(sx, sy + 16 + (i % 5) * 5)
        ctx.stroke()
      }
      // ground line
      ctx.strokeStyle = 'rgba(57,255,111,0.5)'
      ctx.setLineDash([8, 5])
      ctx.beginPath()
      ctx.moveTo(0, GROUND + 0.5)
      ctx.lineTo(W, GROUND + 0.5)
      ctx.stroke()
      ctx.setLineDash([])

      // drop glyphs
      ctx.textAlign = 'center'
      for (const d of st.drops) {
        if (d.dead >= 0) {
          const p = d.dead / 0.7
          ctx.strokeStyle = `rgba(57,255,111,${1 - p})`
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(d.x, d.y, 4 + p * 22, 0, Math.PI * 2)
          ctx.stroke()
          continue
        }
        const dangerY = d.y / GROUND > 0.72
        ctx.font = 'bold 20px monospace'
        if (/[A-Z0-9]/.test(d.ch)) {
          // shift-required glyphs glow amber
          ctx.fillStyle = dangerY ? '#FF5252' : '#FFC46B'
          ctx.shadowColor = 'rgba(255,196,107,0.7)'
          ctx.shadowBlur = 8
        } else {
          ctx.fillStyle = dangerY ? '#FF5252' : '#CFFFE0'
          ctx.shadowColor = 'rgba(57,255,111,0.35)'
          ctx.shadowBlur = 6
        }
        ctx.fillText(d.ch, d.x, d.y)
        ctx.shadowBlur = 0
      }
      ctx.textAlign = 'left'

      // HUD
      ctx.font = '11px monospace'
      ctx.fillStyle = '#39FF6F'
      ctx.fillText(`SCORE ${st.score}`, 12, 18)
      ctx.fillText(`COMBO ×${st.combo}`, 118, 18)
      ctx.fillText(`LVL ${st.level}`, 226, 18)
      ctx.fillText(`WPM ${st.wpm}`, 300, 18)
      for (let i = 0; i < LIVES_MAX; i++) {
        const alive = i < st.lives
        ctx.fillStyle = alive ? '#39FF6F' : 'rgba(31,163,74,0.3)'
        ctx.fillRect(W - 30 - i * 16, 10, 10, 9)
      }
      if (st.flash > 0) {
        st.flash -= dt
        ctx.fillStyle = `rgba(255,82,82,${Math.max(0, st.flash)})`
        ctx.fillRect(-6, -6, W + 12, H + 12)
      }

      if (st.lives <= 0) {
        playKeySound({ kind: 'space', correct: false })
        setFinal({ score: st.score, bestCombo: st.bestCombo, wpm: st.wpm })
        onScore(st.score)
        setPhase('over')
      }
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      paint(dt, now)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, onScore])

  // input: strike matching glyphs, lowest-first
  useEffect(() => {
    if (phase !== 'running') return
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const st = g.current
      if (e.key === 'Escape') {
        setPhase('menu')
        return
      }
      const ch = e.key.length === 1 ? e.key : ''
      if (!ch || ch === ' ') return
      e.preventDefault()
      st.typedChars += 1

      // strike the lowest matching drop — the closest one to landing
      const target = st.drops
        .filter((d) => d.dead < 0 && d.ch === ch)
        .sort((a, b) => b.y - a.y)[0]

      if (target) {
        target.dead = 0
        st.combo += 1
        st.bestCombo = Math.max(st.bestCombo, st.combo)
        st.score += 10 + Math.min(90, st.combo * 2) + st.level * 2
        playKeySound({ kind: 'char', correct: true })
      } else {
        st.combo = 0
        playKeySound({ kind: 'char', correct: false })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative border border-terminal-border bg-terminal-bg">
        {phase === 'running' ? (
          <canvas ref={canvasRef} className="block w-full" style={{ aspectRatio: `${W}/${H}` }} />
        ) : (
          <div className="grid place-items-center p-6 text-center" style={{ minHeight: 200 }}>
            {phase === 'menu' ? (
              <div className="max-w-md">
                <div className="glow font-mono text-xl font-bold tracking-[0.3em] text-terminal-accent">
                  LETTER STORM
                </div>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-terminal-text-dim">
                  endless glyph rain. strike each glyph before it lands —
                  that's the whole storm. combos spike your score, landings
                  burn hull and break the chain. caps and digits join at
                  higher levels: they glow amber.
                </p>
                <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={start}>
                  ▶ START THE STORM
                </button>
              </div>
            ) : (
              <div className="max-w-md">
                <div className="glow-error font-mono text-xl font-bold tracking-[0.3em] text-terminal-error">
                  HULL FLOODED
                </div>
                <p className="mt-2 font-mono text-[11px] tabular-nums text-terminal-text-dim">
                  {final
                    ? `score ${final.score} · best combo ×${final.bestCombo} · ${final.wpm} wpm`
                    : 'the rain got through.'}
                </p>
                <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={start}>
                  ▶ RUN IT AGAIN
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-terminal-text-dim">
        every keystroke counts · amber glyphs need shift · esc aborts
      </p>
    </div>
  )
}
