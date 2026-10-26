import { useCallback, useEffect, useRef, useState } from 'react'
import { playKeySound } from '../../lib/sound'

type Phase = 'menu' | 'running' | 'over'

interface BombView {
  code: string
  pos: number
  remain: number
  total: number
  defused: number
  lives: number
  score: number
  mistakes: number
  fx: 'none' | 'defused' | 'boom'
}

const WIRE_COLORS = ['#FF5252', '#FFC46B', '#39FF6F']

const CODE_CHARS =
  'abcdefghijklmnopqrstuvwxyz' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  '0123456789' +
  '#$%&@!?+='

/** how much of the fuse a wrong keystroke burns (ms) */
const WRONG_PENALTY_MS = 400

function makeCode(defused: number): string {
  const len = Math.min(9, 5 + Math.floor(defused / 3))
  let out = ''
  for (let i = 0; i < len; i++) {
    out += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]
  }
  return out
}

function fuseFor(defused: number): number {
  // 9.5s down to ~4.2s as the operator proves themselves
  return Math.max(4200, 9500 - defused * 380)
}

/**
 * DEFUSE — every bomb carries a mixed-case code laced with digits and
 * symbols. Type the code before the fuse zeroes out. Wrong keys ignite
 * the fuse faster. Three detonations and the vault is gone.
 */
export function Defuse({ onScore }: { onScore: (score: number) => void }) {
  const [phase, setPhase] = useState<Phase>('menu')
  const [bomb, setBomb] = useState<BombView | null>(null)
  const fxTimer = useRef(0)

  const g = useRef({
    code: '',
    pos: 0,
    remain: 0,
    total: 0,
    defused: 0,
    lives: 3,
    score: 0,
    mistakes: 0,
    fx: 'none' as BombView['fx'],
  })

  const clearFx = useCallback(() => {
    window.clearTimeout(fxTimer.current)
    fxTimer.current = window.setTimeout(() => {
      g.current.fx = 'none'
    }, 340)
  }, [])

  const nextBomb = useCallback(() => {
    const st = g.current
    st.code = makeCode(st.defused)
    st.pos = 0
    st.total = fuseFor(st.defused)
    st.remain = st.total
  }, [])

  const start = useCallback(() => {
    const st = g.current
    st.defused = 0
    st.lives = 3
    st.score = 0
    st.mistakes = 0
    st.fx = 'none'
    nextBomb()
    setBomb({
      code: st.code,
      pos: st.pos,
      remain: st.remain,
      total: st.total,
      defused: st.defused,
      lives: st.lives,
      score: st.score,
      mistakes: st.mistakes,
      fx: st.fx,
    })
    setPhase('running')
  }, [nextBomb])

  // while live, the game owns the keyboard (blocks app-level esc navigation)
  useEffect(() => {
    if (phase !== 'running') return
    document.body.dataset.gameCapture = '1'
    return () => {
      delete document.body.dataset.gameCapture
    }
  }, [phase])

  // fuse tick
  useEffect(() => {
    if (phase !== 'running') return
    const id = window.setInterval(() => {
      const st = g.current
      st.remain -= 50
      if (st.remain <= 0) {
        // detonation
        st.lives -= 1
        st.fx = 'boom'
        clearFx()
        playKeySound({ kind: 'space', correct: false })
        if (st.lives <= 0) {
          setBomb({ ...st, code: st.code, pos: st.pos, remain: 0, total: st.total })
          onScore(st.score)
          setPhase('over')
          return
        }
        nextBomb()
      }
      setBomb({ ...st, code: st.code, pos: st.pos, remain: Math.max(0, st.remain), total: st.total })
    }, 50)
    return () => window.clearInterval(id)
  }, [phase, clearFx, nextBomb, onScore])

  // input: exact-char locks; wrong keys burn the fuse
  useEffect(() => {
    if (phase !== 'running') return
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const st = g.current
      if (e.key === 'Escape') {
        onScore(st.score)
        setPhase('over')
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        st.pos = Math.max(0, st.pos - 1)
        setBomb({ ...st, code: st.code, pos: st.pos, remain: st.remain, total: st.total })
        playKeySound({ kind: 'backspace', correct: true })
        return
      }
      if (e.key.length !== 1) return
      e.preventDefault()

      if (e.key === st.code[st.pos]) {
        st.pos += 1
        playKeySound({ kind: 'char', correct: true })
        if (st.pos >= st.code.length) {
          // bomb defused — score bonus scales with fuse left
          const fuseRatio = Math.max(0, st.remain) / st.total
          st.score += 100 + Math.round(fuseRatio * 120)
          st.defused += 1
          st.fx = 'defused'
          clearFx()
          playKeySound({ kind: 'space', correct: true })
          if (st.defused % 4 === 0) {
            // every fourth bomb: small hull repair
            st.lives = Math.min(3, st.lives + 1)
          }
          nextBomb()
        }
      } else {
        st.mistakes += 1
        st.remain -= WRONG_PENALTY_MS
        st.fx = 'none'
        playKeySound({ kind: 'char', correct: false })
      }
      setBomb({ ...st, code: st.code, pos: st.pos, remain: Math.max(0, st.remain), total: st.total })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, clearFx, nextBomb, onScore])

  const fusePct = bomb ? (bomb.remain / bomb.total) * 100 : 0
  const danger = fusePct < 34

  return (
    <div className="flex flex-col gap-2">
      <div className="relative border border-terminal-border bg-terminal-bg">
        {phase === 'running' && bomb ? (
          <div
            className={`relative flex flex-col items-center gap-4 px-3 py-6 sm:gap-5 sm:py-9 ${
              bomb.fx === 'boom'
                ? 'bg-terminal-error/10'
                : bomb.fx === 'defused'
                  ? 'bg-terminal-accent/5'
                  : ''
            }`}
          >
            {/* top telemetry */}
            <div className="flex w-full items-center justify-between font-mono text-[10px] tabular-nums tracking-[0.2em] text-terminal-text-dim">
              <span>
                defused <span className="text-terminal-accent">{bomb.defused}</span>
              </span>
              <span>
                score <span className="text-terminal-accent glow">{bomb.score}</span>
              </span>
              <span className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 border ${
                      i < bomb.lives
                        ? 'border-terminal-accent bg-terminal-accent'
                        : 'border-terminal-border bg-transparent'
                    }`}
                  />
                ))}
                <span className="ml-1">hull</span>
              </span>
            </div>

            {/* decorative wires */}
            <div className="flex gap-1.5">
              {WIRE_COLORS.map((c, i) => (
                <span
                  key={i}
                  className="h-6 w-1 rounded-full sm:h-9"
                  style={{ background: c, boxShadow: `0 0 8px ${c}66` }}
                />
              ))}
              <span className="ml-1 self-center font-mono text-[9px] tracking-[0.3em] text-terminal-text-dim">
                C4 · BOARD {String(bomb.defused + 1).padStart(2, '0')}
              </span>
            </div>

            {/* the code */}
            <div className="flex flex-wrap justify-center gap-1 sm:gap-1.5" aria-hidden>
              {bomb.code.split('').map((ch, i) => {
                const done = i < bomb.pos
                const current = i === bomb.pos
                return (
                  <span
                    key={i}
                    className={`grid h-9 min-w-[24px] place-items-center border font-mono text-lg font-bold sm:h-12 sm:min-w-[34px] sm:text-2xl ${
                      done
                        ? 'border-terminal-accent/70 bg-terminal-accent/15 text-terminal-accent'
                        : current
                          ? `border-terminal-text bg-terminal-panel text-terminal-text ${
                              danger ? 'animate-pulse' : ''
                            }`
                          : 'border-terminal-border/50 text-terminal-text-dim/60'
                    }`}
                  >
                    {ch}
                  </span>
                )
              })}
            </div>

            {/* fuse bar */}
            <div className="w-full max-w-md">
              <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.25em] text-terminal-text-dim">
                <span>FUSE</span>
                <span className={danger ? 'text-terminal-error glow-error' : 'text-terminal-text'}>
                  {(bomb.remain / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="mt-1 h-3 border border-terminal-border/70 bg-terminal-bg/70 p-px">
                <div
                  className={`h-full transition-[width] duration-75 ${
                    danger ? 'bg-terminal-error' : bomb.fx === 'defused' ? 'bg-terminal-accent' : 'bg-terminal-warning'
                  }`}
                  style={{ width: `${Math.max(fusePct, 1)}%` }}
                />
              </div>
            </div>

            <p className="text-center font-mono text-[9px] leading-relaxed tracking-[0.15em] text-terminal-text-dim">
              type the code exactly · backspace rewinds one wire
              <span className="mx-2 text-terminal-warning">
                wrong key: −{(WRONG_PENALTY_MS / 1000).toFixed(1)}s fuse
              </span>
              esc aborts
            </p>
          </div>
        ) : (
          <div className="grid place-items-center p-6 text-center" style={{ minHeight: 200 }}>
            {phase === 'menu' ? (
              <div className="max-w-md">
                <div className="glow font-mono text-xl font-bold tracking-[0.3em] text-terminal-accent">
                  DEFUSE
                </div>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-terminal-text-dim">
                  bombs keep arriving with codes laced through letters, digits
                  and symbols. lock each code before the fuse zeroes — wrong
                  keys burn it faster. codes grow longer as you prove steady
                  hands.
                </p>
                <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={start}>
                  ▶ ARM THE CIRCUITS
                </button>
              </div>
            ) : (
              <div className="max-w-md">
                <div className="glow-error font-mono text-xl font-bold tracking-[0.3em] text-terminal-error">
                  VAULT BLOWN
                </div>
                <p className="mt-2 font-mono text-[11px] tabular-nums text-terminal-text-dim">
                  {bomb
                    ? `${bomb.defused} bombs defused · score ${bomb.score} · ${bomb.mistakes} burnt keys`
                    : 'signal lost.'}
                </p>
                <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={start}>
                  ▶ ANOTHER TOUR
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
