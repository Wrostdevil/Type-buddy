import { useCallback, useEffect, useRef, useState } from 'react'
import { COMMON_WORDS } from '../../lib/words'
import { playKeySound } from '../../lib/sound'

type Phase = 'menu' | 'running' | 'over'

const W = 920
const H = 300
const GROUND = H - 34
const STRIKER_X = 70
const MELEE_X = 150

interface Enemy {
  word: string
  typed: number
  x: number
  speed: number
  atkTimer: number
  hurt: number
  dead: number
}

interface Slash {
  x: number
  y: number
  age: number
}

interface BrawlerState {
  enemies: Enemy[]
  slashes: Slash[]
  hp: number
  hpMax: number
  wave: number
  kills: number
  spawnTimer: number
  slashFx: number
  hurtFx: number
  typedChars: number
  wpm: 0 | number
  startedAt: number
}

function wordFor(wave: number): string {
  const maxLen = Math.min(9, 4 + Math.floor(wave / 2))
  const pool = COMMON_WORDS.filter((w) => w.length >= 3 && w.length <= maxLen)
  return pool[(Math.random() * pool.length) | 0] ?? 'ghost'
}

/**
 * WORD BRAWLER — duel ghosts in a one-lane arena. The nearest enemy is
 * locked on: every correct letter lands a sword slash. Kill it before it
 * reaches melee range, where its own timer starts parry-proof damage.
 */
export function Brawler({ onScore }: { onScore: (score: number) => void }) {
  const [phase, setPhase] = useState<Phase>('menu')
  const [final, setFinal] = useState<{ score: number; kills: number; wave: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const g = useRef<BrawlerState>({
    enemies: [],
    slashes: [],
    hp: 30,
    hpMax: 30,
    wave: 1,
    kills: 0,
    spawnTimer: 0,
    slashFx: 0,
    hurtFx: 0,
    typedChars: 0,
    wpm: 0,
    startedAt: 0,
  })

  const start = useCallback(() => {
    const st = g.current
    st.enemies = []
    st.slashes = []
    st.hp = 30
    st.hpMax = 30
    st.wave = 1
    st.kills = 0
    st.spawnTimer = 0.4
    st.slashFx = 0
    st.hurtFx = 0
    st.typedChars = 0
    st.wpm = 0
    st.startedAt = performance.now()
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
      st.wave = 1 + Math.floor(elapsed / 15)
      if (elapsed > 1) {
        st.wpm = Math.max(0, Math.round(st.typedChars / 5 / (elapsed / 60)))
      }

      // spawn logic — at most 2 concurrent
      st.spawnTimer -= dt
      const aliveNow = st.enemies.filter((e) => e.dead < 0)
      if (st.spawnTimer <= 0 && aliveNow.length < (st.wave >= 3 ? 2 : 1)) {
        st.enemies.push({
          word: wordFor(st.wave),
          typed: 0,
          x: W + 30,
          speed: 16 + st.wave * 5 + Math.random() * 8,
          atkTimer: 1.6,
          hurt: 0,
          dead: -1,
        })
        st.spawnTimer = Math.max(0.9, 2.2 - st.wave * 0.15)
      }

      // simulate
      for (const e of st.enemies) {
        if (e.dead >= 0) {
          e.dead += dt
          continue
        }
        e.hurt = Math.max(0, e.hurt - dt * 4)
        if (e.x > MELEE_X) {
          e.x -= e.speed * dt
        } else {
          e.atkTimer -= dt
          if (e.atkTimer <= 0) {
            e.atkTimer = 1.6
            st.hp -= 6
            st.hurtFx = 0.45
            playKeySound({ kind: 'space', correct: false })
          }
        }
      }
      st.enemies = st.enemies.filter((e) => e.dead < 0.7)
      for (const s of st.slashes) s.age += dt
      st.slashes = st.slashes.filter((s) => s.age < 0.35)
      st.slashFx = Math.max(0, st.slashFx - dt * 3)
      st.hurtFx = Math.max(0, st.hurtFx - dt * 2)

      // ── draw ──
      ctx.fillStyle = '#010602'
      ctx.fillRect(-4, -4, W + 8, H + 8)
      // faint arena grid
      ctx.strokeStyle = 'rgba(57,255,111,0.07)'
      for (let x = 0; x < W; x += 46) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, GROUND)
        ctx.stroke()
      }
      // ground line
      ctx.strokeStyle = 'rgba(57,255,111,0.55)'
      ctx.setLineDash([10, 6])
      ctx.beginPath()
      ctx.moveTo(0, GROUND + 0.5)
      ctx.lineTo(W, GROUND + 0.5)
      ctx.stroke()
      ctx.setLineDash([])

      // striker
      const swing = st.slashFx * 14
      ctx.save()
      ctx.fillStyle = '#39FF6F'
      ctx.shadowColor = 'rgba(57,255,111,0.8)'
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.moveTo(STRIKER_X - 14, GROUND)
      ctx.lineTo(STRIKER_X - 2, GROUND - 26)
      ctx.lineTo(STRIKER_X + 8, GROUND - 12)
      ctx.lineTo(STRIKER_X + 16, GROUND)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      // blade
      ctx.strokeStyle = 'rgba(207,255,224,0.95)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(STRIKER_X + 8, GROUND - 14)
      ctx.lineTo(STRIKER_X + 30 + swing, GROUND - 22 - swing)
      ctx.stroke()

      // enemies + locked-on marker
      const alive = st.enemies.filter((e) => e.dead < 0).sort((a, b) => a.x - b.x)
      const nearest = alive[0]
      ctx.textAlign = 'center'
      for (const e of st.enemies) {
        const ex = e.x
        if (e.dead >= 0) {
          const p = e.dead / 0.7
          ctx.strokeStyle = `rgba(255,82,82,${1 - p})`
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(ex, GROUND - 18, 6 + p * 26, 0, Math.PI * 2)
          ctx.stroke()
          continue
        }
        const locked = e === nearest
        // body
        ctx.fillStyle = e.hurt > 0 ? '#FFC46B' : locked ? '#FF5252' : '#8C2B33'
        ctx.shadowColor = 'rgba(255,82,82,0.5)'
        ctx.shadowBlur = locked ? 10 : 0
        ctx.beginPath()
        ctx.moveTo(ex - 12, GROUND)
        ctx.lineTo(ex - 12, GROUND - 18)
        ctx.lineTo(ex, GROUND - 28)
        ctx.lineTo(ex + 12, GROUND - 18)
        ctx.lineTo(ex + 12, GROUND)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
        // word above
        ctx.font = 'bold 13px monospace'
        ctx.fillStyle = locked ? '#FF5252' : 'rgba(255,82,82,0.75)'
        ctx.fillText(e.word, ex, GROUND - 38)
        if (locked && e.typed > 0) {
          ctx.font = 'bold 13px monospace'
          ctx.fillStyle = '#39FF6F'
          ctx.fillText(e.word.slice(0, e.typed), ex, GROUND - 38)
        }
        if (locked && e.typed === 0) {
          ctx.strokeStyle = 'rgba(57,255,111,0.8)'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(STRIKER_X + 20, GROUND - 18)
          ctx.lineTo(ex - 16, GROUND - 22)
          ctx.stroke()
        }
      }

      // slashes
      for (const s of st.slashes) {
        const p = s.age / 0.35
        ctx.strokeStyle = `rgba(207,255,224,${1 - p})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(s.x, s.y, 4 + p * 20, -0.8, 0.9)
        ctx.stroke()
      }

      // HUD
      ctx.textAlign = 'left'
      ctx.font = '11px monospace'
      ctx.fillStyle = '#39FF6F'
      ctx.fillText(`WAVE ${st.wave}`, 12, 18)
      ctx.fillText(`SLAIN ${st.kills}`, 90, 18)
      ctx.fillText(`WPM ${st.wpm}`, 174, 18)
      // hp bar
      ctx.fillStyle = 'rgba(95,169,124,0.8)'
      ctx.fillText('HULL', W - 190, 18)
      ctx.fillStyle = '#010602'
      ctx.fillRect(W - 152, 8, 140, 10)
      ctx.strokeStyle = 'rgba(31,163,74,0.7)'
      ctx.strokeRect(W - 152.5, 8.5, 140, 9)
      ctx.fillStyle = st.hp / st.hpMax > 0.35 ? '#39FF6F' : '#FF5252'
      ctx.fillRect(W - 151, 9.5, Math.max(0, (st.hp / st.hpMax) * 138), 7)

      if (st.hurtFx > 0) {
        ctx.fillStyle = `rgba(255,82,82,${st.hurtFx * 0.4})`
        ctx.fillRect(-4, -4, W + 8, H + 8)
      }

      if (st.hp <= 0) {
        playKeySound({ kind: 'space', correct: false })
        setFinal({ score: st.kills * 15 + st.wave * 100, kills: st.kills, wave: st.wave })
        onScore(st.kills * 15 + st.wave * 100)
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

  // input: letters relentless on the nearest enemy
  useEffect(() => {
    if (phase !== 'running') return
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const st = g.current
      if (e.key === 'Escape') {
        setPhase('menu')
        return
      }
      const ch = e.key.toLowerCase()
      if (ch.length !== 1 || ch < 'a' || ch > 'z') return

      const alive = st.enemies.filter((en) => en.dead < 0).sort((a, b) => a.x - b.x)
      const nearest = alive[0]
      if (!nearest) return

      if (ch === nearest.word[nearest.typed]) {
        nearest.typed += 1
        st.typedChars += 1
        st.slashFx = 1
        st.slashes.push({ x: nearest.x - 8, y: GROUND - 20, age: 0 })
        playKeySound({ kind: 'char', correct: true })
        if (nearest.typed >= nearest.word.length) {
          nearest.dead = 0
          st.kills += 1
          st.hp = Math.min(st.hpMax, st.hp + 3)
          playKeySound({ kind: 'space', correct: true })
        }
      } else {
        st.typedChars += 1
        st.hurtFx = Math.max(st.hurtFx, 0.2)
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
                  WORD BRAWLER
                </div>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-terminal-text-dim">
                  ghosts march on your striker in single file. the closest foe
                  is lock-red — every letter of its word lands a slash. kill it
                  before it plants at your line, because then its own clock
                  starts burning your hull. each kill repairs +3.
                </p>
                <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={start}>
                  ▶ ENTER THE ARENA
                </button>
              </div>
            ) : (
              <div className="max-w-md">
                <div className="glow-error font-mono text-xl font-bold tracking-[0.3em] text-terminal-error">
                  STRIKER DOWN
                </div>
                <p className="mt-2 font-mono text-[11px] tabular-nums text-terminal-text-dim">
                  {final
                    ? `score ${final.score} · ${final.kills} ghost slayers repelled · reached wave ${final.wave}`
                    : 'the arena claims another.'}
                </p>
                <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={start}>
                  ▶ REMATCH
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-terminal-text-dim">
        every landed letter is a slash · the red-locked enemy is your target · esc aborts
      </p>
    </div>
  )
}
