import { useCallback, useEffect, useRef, useState } from 'react'
import { playKeySound } from '../../lib/sound'

type Phase = 'menu' | 'armed' | 'over'

const ROUNDS = 10
const KEYS = 'abcdefghijklmnopqrstuvwxyz'.split('')

/**
 * PULSE-KEY — a target glyph flashes; hammer it as fast as you can.
 * Ten rounds, wrong keys add a 400 ms penalty. Lower average = colder
 * nerves. Home-row keys (f j d k) are excluded: they're too easy bait.
 */
export function Reaction({ onScore }: { onScore: (avgMs: number) => void }) {
  const [phase, setPhase] = useState<Phase>('menu')
  const [target, setTarget] = useState<string | null>(null)
  const [hud, setHud] = useState({ round: 0, last: 0, best: 0, avg: 0 })
  const [misses, setMisses] = useState(0)

  const armedAtRef = useRef(0)
  const timesRef = useRef<number[]>([])

  const armNext = useCallback(() => {
    setTarget(KEYS[(Math.random() * KEYS.length) | 0])
    armedAtRef.current = performance.now()
  }, [])

  const start = useCallback(() => {
    timesRef.current = []
    setHud({ round: 0, last: 0, best: 0, avg: 0 })
    setMisses(0)
    setPhase('armed')
    armNext()
  }, [armNext])

  // while armed, the game owns the keyboard (blocks app-level esc navigation)
  useEffect(() => {
    if (phase !== 'armed') return
    document.body.dataset.gameCapture = '1'
    return () => {
      delete document.body.dataset.gameCapture
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'armed') return
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') {
        setPhase('menu')
        return
      }
      const ch = e.key.toLowerCase()
      const now = performance.now()
      let ms: number
      if (target && ch === target) {
        ms = Math.max(40, now - armedAtRef.current)
        playKeySound({ kind: 'char', correct: true })
      } else {
        ms = Math.max(40, now - armedAtRef.current) + 400
        setMisses((m) => m + 1)
        playKeySound({ kind: 'char', correct: false })
      }
      const times = [...timesRef.current, ms]
      timesRef.current = times
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      setHud({
        round: times.length,
        last: Math.round(ms),
        best: Math.min(...times),
        avg,
      })
      if (times.length >= ROUNDS) {
        onScore(avg)
        setPhase('over')
      } else {
        armNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, target])

  return (
    <div className="flex flex-col gap-3">
      <div
        className="win scan-lines grid place-items-center p-6 text-center"
        style={{ minHeight: 190 }}
      >
        {phase === 'menu' ? (
          <div className="max-w-md">
            <div className="glow font-mono text-xl font-bold tracking-[0.3em] text-terminal-accent">
              PULSE-KEY
            </div>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-terminal-text-dim">
              {ROUNDS} rounds. a glyph flares up — hit it instantly. wrong keys
              add a 400 ms penalty each. steady hands, phantom.
            </p>
            <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={start}>
              ▶ ARM SEQUENCE
            </button>
          </div>
        ) : phase === 'armed' ? (
          <div>
            <div className="font-mono text-[9px] tracking-[0.3em] text-terminal-text-dim">
              STRIKE NOW — round {hud.round + 1}/{ROUNDS}
            </div>
            <div
              className="glow mt-3 grid h-24 w-24 place-items-center border-2 border-terminal-accent bg-terminal-accent/10 font-mono text-5xl font-bold text-terminal-accent"
              style={{ boxShadow: '0 0 26px rgba(57,255,111,0.5)' }}
            >
              {target?.toUpperCase()}
            </div>
            <div className="mt-3 font-mono text-[10px] tabular-nums text-terminal-text-dim">
              last {hud.last}ms · avg {hud.avg}ms · slips {misses}
            </div>
          </div>
        ) : (
          <div className="max-w-md">
            <div className="glow font-mono text-xl font-bold tracking-[0.3em] text-terminal-accent">
              REFLEXES LOGGED
            </div>
            <div className="mt-3 flex justify-center gap-6 font-mono text-sm tabular-nums text-terminal-text">
              <span>
                avg <span className="text-terminal-accent">{hud.avg}ms</span>
              </span>
              <span>
                best <span className="text-terminal-accent">{hud.best}ms</span>
              </span>
              <span className="text-terminal-error">slips {misses}</span>
            </div>
            <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={start}>
              ▶ AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
