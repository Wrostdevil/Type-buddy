import { useCallback, useEffect, useRef, useState } from 'react'
import { COMMON_WORDS } from '../../lib/words'
import { playKeySound } from '../../lib/sound'

type Phase = 'menu' | 'running' | 'over'

interface Floater {
  id: number
  word: string
  x: number
  y: number
  vy: number
  typed: number
  dead: number // explosion age in seconds, -1 while alive
}

const W = 920
const H = 460
const GROUND = H - 26
const LIVES_MAX = 3

const POOL = COMMON_WORDS.filter((w) => w.length >= 3 && w.length <= 8)

/**
 * INVADERS — words drop from orbit. Type them to zero before they hit the
 * deck floor. Three hull breaches and the mission is over.
 */
export function Invaders({ onScore }: { onScore: (score: number, wpm: number) => void }) {
  const [phase, setPhase] = useState<Phase>('menu')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef({
    floaters: [] as Floater[],
    typed: '',
    score: 0,
    lives: LIVES_MAX,
    errors: 0,
    hits: 0,
    startedAt: 0,
    spawnAt: 0,
    level: 1,
    flash: 0,
    shake: 0,
    nextId: 1,
    typedChars: 0,
    wpm: 0,
  })

  const start = useCallback(() => {
    const g = gameRef.current
    g.floaters = []
    g.typed = ''
    g.score = 0
    g.lives = LIVES_MAX
    g.errors = 0
    g.hits = 0
    g.typedChars = 0
    g.startedAt = performance.now()
    g.spawnAt = 0
    g.level = 1
    g.wpm = 0
    setPhase('running')
  }, [])

  // while live, the game owns the keyboard (blocks app-level esc navigation)
  useEffect(() => {
    if (phase !== 'running') return
    document.body.dataset.gameCapture = '1'
    return () => {
      delete document.body.dataset.gameCapture
    }
  }, [phase])

  // the run loop (own canvas, fixed timestep paint ~30fps)
  useEffect(() => {
    if (phase !== 'running') return
    const canvas = canvasRef.current
    if (!canvas) return
    const g = canvas.getContext('2d')
    if (!g) return
    canvas.width = W
    canvas.height = H
    let raf = 0
    let last = performance.now()
    let acc = 0
    const spawnEvery = (): number => Math.max(1.1, 2.6 - gameRef.current.level * 0.18)

    const paint = (dt: number, t: number) => {
      // ── simulate ──
      const st = gameRef.current
      acc += dt
      const elapsed = (t - st.startedAt) / 1000
      st.level = 1 + Math.floor(elapsed / 16)

      // spawn
      if (elapsed - st.spawnAt >= spawnEvery() || st.floaters.length === 0) {
        st.spawnAt = elapsed
        st.floaters.push({
          id: st.nextId++,
          word: POOL[(Math.random() * POOL.length) | 0],
          x: 30 + Math.random() * (W - 160),
          y: -10,
          vy: 22 + st.level * 5 + Math.random() * 12,
          typed: 0,
          dead: -1,
        })
      }

      // move
      for (const f of st.floaters) {
        if (f.dead >= 0) {
          f.dead += dt
        } else {
          f.y += f.vy * dt
          if (f.y > GROUND) {
            f.dead = 0
            st.lives -= 1
            st.flash = 0.5
            playKeySound({ kind: 'space', correct: false })
          }
        }
      }
      st.floaters = st.floaters.filter((f) => f.dead < 0.9)

      // wpm (typed chars incl. spaces commit)
      if (elapsed > 1) {
        st.wpm = Math.max(0, Math.round(st.typedChars / 5 / (elapsed / 60)))
      }

      // ── draw ──
      const shake = st.shake > 0 ? (st.shake -= dt) > 0 ? (Math.random() - 0.5) * 6 : 0 : 0
      g.save()
      if (shake) g.translate(shake, shake * 0.6)
      g.fillStyle = '#010602'
      g.fillRect(-8, -8, W + 16, H + 16)

      // starfield
      g.fillStyle = 'rgba(57,255,111,0.25)'
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97 + ((t / 60) * (14 + (i % 5) * 4))) % W
        const sy = (i * 53 + (t / 60) * (20 + (i % 7) * 6)) % GROUND
        g.fillRect(sx, sy, 1, 1)
      }

      // deck floor line
      g.strokeStyle = 'rgba(57,255,111,0.5)'
      g.setLineDash([8, 5])
      g.beginPath()
      g.moveTo(0, GROUND + 0.5)
      g.lineTo(W, GROUND + 0.5)
      g.stroke()
      g.setLineDash([])

      // floaters
      g.textAlign = 'left'
      for (const f of st.floaters) {
        if (f.dead >= 0) {
          const p = f.dead / 0.9
          g.strokeStyle = `rgba(57,255,111,${1 - p})`
          g.lineWidth = 2
          g.beginPath()
          g.arc(f.x + 20, f.y + 8, 4 + p * 30, 0, Math.PI * 2)
          g.stroke()
          g.beginPath()
          g.arc(f.x + 20, f.y + 8, 2 + p * 16, 0, Math.PI * 2)
          g.stroke()
          continue
        }
        const targeted = f.typed > 0
        // typed part bright, rest dim; ship glyph below the word
        g.font = 'bold 14px monospace'
        g.fillStyle = targeted ? '#39FF6F' : 'rgba(207,255,224,0.92)'
        g.fillText(f.word.slice(0, f.typed), f.x, f.y)
        g.fillStyle = targeted ? 'rgba(57,255,111,0.35)' : 'rgba(95,169,124,0.8)'
        g.fillText(f.word.slice(f.typed), f.x + g.measureText(f.word.slice(0, f.typed)).width, f.y)
        // little ship
        g.fillStyle = '#1FA34A'
        g.fillRect(f.x + 4, f.y + 6, 30, 3)
        g.fillRect(f.x + 12, f.y + 2, 14, 3)
        g.fillStyle = '#39FF6F'
        g.fillRect(f.x + 17, f.y + 9, 4, 2)
      }

      // typed buffer bottom-left
      g.font = 'bold 15px monospace'
      g.fillStyle = st.typed ? '#39FF6F' : 'rgba(95,169,124,0.6)'
      g.fillText(`» ${st.typed}${Math.floor(t / 400) % 2 === 0 ? '_' : ''}`, 12, H - 8)

      // HUD: score / lives / level / wpm
      g.font = '11px monospace'
      g.fillStyle = '#39FF6F'
      g.fillText(`SCORE ${st.score}`, 12, 18)
      g.fillText(`LEVEL ${st.level}`, 150, 18)
      g.fillText(`WPM ${st.wpm}`, 250, 18)
      for (let i = 0; i < LIVES_MAX; i++) {
        const alive = i < st.lives
        g.fillStyle = alive ? '#39FF6F' : 'rgba(31,163,74,0.35)'
        g.fillRect(W - 30 - i * 16, 10, 10, 9)
        g.fillStyle = '#010602'
        g.fillRect(W - 27 - i * 16, 13, 4, 3)
      }
      g.fillStyle = 'rgba(31,163,74,0.8)'
      g.fillText('HULL', W - 84, 18)

      // hull flash
      if (st.flash > 0) {
        st.flash -= dt
        g.fillStyle = `rgba(255,82,82,${Math.max(0, st.flash)})`
        g.fillRect(-8, -8, W + 16, H + 16)
      }
      g.restore()

      // game over?
      if (st.lives <= 0) {
        playKeySound({ kind: 'space', correct: false })
        onScore(st.score, st.wpm)
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
  }, [phase])

  // input: letters build the lock buffer; full words detonate with or without space
  useEffect(() => {
    if (phase !== 'running') return
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const st = gameRef.current
      if (e.key === 'Escape') {
        setPhase('over')
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        st.typed = st.typed.slice(0, -1)
        return
      }
      const ch = e.key.toLowerCase()
      if (ch.length !== 1 || ch < 'a' || ch > 'z') return

      const next = st.typed + ch
      const exact = st.floaters.find(
        (f) => f.dead < 0 && f.word.toLowerCase() === next,
      )
      const prefixes = st.floaters.some(
        (f) => f.dead < 0 && f.word.toLowerCase().startsWith(next),
      )

      if (exact) {
        // instant detonation when the buffer completes a word
        exact.dead = 0
        st.score += exact.word.length * 10 * st.level
        st.typedChars += exact.word.length + 1
        st.shake = 0.12
        playKeySound({ kind: 'space', correct: true })
        st.typed = ''
      } else if (prefixes) {
        st.typed = next
        st.typedChars += 1
        playKeySound({ kind: 'char', correct: true })
      } else {
        // dead-end keystroke: dud sound, buffer resets for a fresh lock
        st.errors += 1
        st.typed = ''
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
          <div
            className="grid place-items-center p-6 text-center"
            style={{ minHeight: 200 }}
          >
            {phase === 'menu' ? (
              <MenuCard onLaunch={start} />
            ) : (
              <OverCard onRetry={start} />
            )}
          </div>
        )}
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-terminal-text-dim">
        type the falling prompts to zero them out before they cross the dashed
        deck line · space detonates a fully typed word · esc aborts
      </p>
    </div>
  )
}

function MenuCard({ onLaunch }: { onLaunch: () => void }) {
  return (
    <div className="max-w-md">
      <div className="font-mono text-xl font-bold tracking-[0.3em] text-terminal-accent glow">
        INVADERS
      </div>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-terminal-text-dim">
        hostile vocabulary is dropping toward the deck. lock each word in your
        buffer and detonate it — three hull breaches and it's over. speed and
        spawn rate scale with survival time.
      </p>
      <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={onLaunch}>
        ▶ LAUNCH
      </button>
    </div>
  )
}

function OverCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="max-w-md">
      <div className="glow-error font-mono text-xl font-bold tracking-[0.3em] text-terminal-error">
        HULL BREACHED
      </div>
      <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={onRetry}>
        ▶ RUN IT AGAIN
      </button>
    </div>
  )
}
