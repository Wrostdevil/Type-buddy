import { useCallback, useEffect, useRef, useState } from 'react'
import { COMMON_WORDS } from '../../lib/words'
import { playKeySound } from '../../lib/sound'

type Phase = 'menu' | 'running' | 'caught'

interface ChaseView {
  gap: number
  wpm: number
  seconds: number
  typedChars: number
  errors: number
  level: number
  /** payload window for display */
  shown: string
  typedShown: number
}

interface ChaseState {
  text: string
  pos: number
  gap: number
  typedChars: number
  errors: number
  startedAt: number
  wpm: number
}

const GAP_START = 74
const GAP_MAX = 74
const WINDOW_BACK = 26
const WINDOW_FWD = 30

/** rendered snapshot derived from live game state (never during render) */
function snapshot(st: ChaseState): ChaseView {
  const seconds = st.startedAt ? (Date.now() - st.startedAt) / 1000 : 0
  const sliceStart = Math.max(0, st.pos - WINDOW_BACK)
  const shown = st.text.slice(sliceStart, st.pos + WINDOW_FWD)
  return {
    gap: st.gap,
    wpm: st.wpm,
    seconds,
    typedChars: st.typedChars,
    errors: st.errors,
    level: 1 + Math.floor(seconds / 12),
    shown,
    typedShown: Math.min(st.pos - sliceStart, shown.length),
  }
}

function makeBuffer(): string {
  const out: string[] = []
  for (let i = 0; i < 18; i++) out.push(COMMON_WORDS[(Math.random() * COMMON_WORDS.length) | 0])
  return out.join(' ')
}

/**
 * GHOST CHASE — a spectral hunter is eating the gap between you and it.
 * Every correct keystroke pushes it back; every slip and every second of
 * silence lets it surge closer. Escaped "meters" = typed characters.
 */
export function GhostChase({ onScore }: { onScore: (score: number) => void }) {
  const [phase, setPhase] = useState<Phase>('menu')
  const [view, setView] = useState<ChaseView | null>(null)
  const g = useRef<ChaseState>({
    text: '',
    pos: 0,
    gap: GAP_START,
    typedChars: 0,
    errors: 0,
    startedAt: 0,
    wpm: 0,
  })

  const extend = useCallback(() => {
    const st = g.current
    if (st.text.length - st.pos < 60) {
      const more: string[] = []
      for (let i = 0; i < 10; i++) more.push(COMMON_WORDS[(Math.random() * COMMON_WORDS.length) | 0])
      st.text = `${st.text} ${more.join(' ')}`
    }
  }, [])

  const start = useCallback(() => {
    const st = g.current
    st.text = makeBuffer()
    st.pos = 0
    st.gap = GAP_START
    st.typedChars = 0
    st.errors = 0
    st.startedAt = 0
    st.wpm = 0
    setView(snapshot(st))
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

  // hunter pace + telemetry tick
  useEffect(() => {
    if (phase !== 'running') return
    const id = window.setInterval(() => {
      const st = g.current
      const seconds = st.startedAt ? (Date.now() - st.startedAt) / 1000 : 0
      const level = 1 + Math.floor(seconds / 12)
      if (st.startedAt) {
        // the hunter gains ground every second — faster every level
        st.gap -= (1.5 + level * 0.4) / 10
        st.gap = Math.min(GAP_MAX, st.gap)
        const minutes = seconds / 60
        st.wpm = st.typedChars > 0 ? Math.round(st.typedChars / 5 / minutes) : 0
      }
      const snap = snapshot(st)
      setView(snap)
      if (st.gap <= 2) {
        const score = Math.round(snap.seconds * 12) + st.typedChars
        playKeySound({ kind: 'space', correct: false })
        onScore(score)
        setPhase('caught')
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [phase, onScore])

  // typing: every landed char shoves the hunter back
  useEffect(() => {
    if (phase !== 'running') return
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const st = g.current
      if (e.key === 'Escape') {
        setPhase('menu')
        return
      }
      if (e.key.length !== 1) return
      e.preventDefault()
      if (!st.startedAt) st.startedAt = Date.now()
      if (e.key === st.text[st.pos]) {
        st.pos += 1
        st.typedChars += 1
        st.gap = Math.min(GAP_MAX, st.gap + 0.55)
        playKeySound({ kind: 'char', correct: true })
        extend()
      } else {
        st.errors += 1
        st.gap -= 5.5
        playKeySound({ kind: 'char', correct: false })
      }
      // publish immediately so the passage/caret follows the keystroke
      setView(snapshot(st))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, extend])

  // rail positions: runner is pinned; hunter sits gap% to its right
  const runnerPct = 18
  const hunterPct = Math.min(97, runnerPct + (view?.gap ?? GAP_START))
  const danger = (view?.gap ?? GAP_START) < 22

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative border bg-terminal-bg ${
          phase === 'running' && danger ? 'border-terminal-error/70 animate-pulse' : 'border-terminal-border'
        }`}
      >
        {phase === 'running' && view ? (
          <div className="flex flex-col gap-3 p-3 sm:gap-4 sm:p-4">
            {/* the chase rail */}
            <div className="relative h-16 overflow-visible">
              <div className="absolute bottom-1.5 left-0 right-0 border-t border-dashed border-terminal-border/70" />
              {/* hunter */}
              <div
                className="absolute bottom-3 transition-[left] duration-100"
                style={{ left: `${hunterPct}%` }}
              >
                <div className="text-right font-mono text-[8px] tracking-[0.2em] text-terminal-error">
                  HUNTER
                </div>
                <div
                  className="mt-0.5 ml-auto h-4 w-0 border-y-[7px] border-l-[14px] border-y-transparent"
                  style={{
                    borderLeftColor: '#FF5252',
                    filter: 'drop-shadow(0 0 8px rgba(255,82,82,0.8))',
                  }}
                />
              </div>
              {/* runner */}
              <div
                className="absolute bottom-3 transition-[left] duration-100"
                style={{ left: `${runnerPct}%` }}
              >
                <div className="font-mono text-[8px] tracking-[0.2em] text-terminal-accent">YOU</div>
                <div
                  className="mt-0.5 h-3.5 w-3.5 rounded-sm bg-terminal-accent"
                  style={{ boxShadow: '0 0 12px rgba(57,255,111,0.9)' }}
                />
                <div className="mt-0.5 flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-px w-2 bg-terminal-accent/60"
                      style={{ opacity: 0.8 - i * 0.25 }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* gap meter */}
            <div>
              <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.25em] text-terminal-text-dim">
                <span>GAP</span>
                <span className={danger ? 'glow-error text-terminal-error' : 'text-terminal-accent'}>
                  {Math.round(view.gap)}% · LVL {view.level} · {view.seconds.toFixed(0)}s
                </span>
              </div>
              <div className="mt-1 h-2.5 border border-terminal-border/70 bg-terminal-bg/70 p-px">
                <div
                  className={`h-full transition-[width] duration-100 ${
                    danger ? 'bg-terminal-error' : 'bg-terminal-accent'
                  }`}
                  style={{ width: `${Math.max(view.gap, 2)}%` }}
                />
              </div>
            </div>

            {/* payload */}
            <div
              className="border border-terminal-border/60 bg-black/40 p-3 font-mono text-sm leading-6 sm:text-base"
              aria-hidden
            >
              <span className="text-terminal-text-dim/50">{view.shown.slice(0, Math.max(0, view.typedShown - 2))}</span>
              <span data-caret className="caret" />
              <span className="text-terminal-text-dim">{view.shown.slice(Math.max(0, view.typedShown))}</span>
            </div>

            <div className="flex items-center justify-between font-mono text-[10px] tabular-nums text-terminal-text-dim">
              <span>
                wpm <span className="text-terminal-accent">{view.wpm}</span>
                <span className="ml-3">
                  slips <span className="text-terminal-error">{view.errors}</span>
                </span>
                <span className="ml-3">
                  escaped <span className="text-terminal-text">{view.typedChars}m</span>
                </span>
              </span>
              <span>esc abort</span>
            </div>
          </div>
        ) : (
          <div className="grid place-items-center p-6 text-center" style={{ minHeight: 200 }}>
            {phase === 'menu' ? (
              <div className="max-w-md">
                <div className="glow font-mono text-xl font-bold tracking-[0.3em] text-terminal-accent">
                  GHOST CHASE
                </div>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-terminal-text-dim">
                  a hunter keeps closing in — every correct character shoves it
                  back, every slip costs five meters and every second of silence
                  feeds it. outpace the decay as long as you can.
                </p>
                <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={start}>
                  ▶ START RUNNING
                </button>
              </div>
            ) : (
              <div className="max-w-md">
                <div className="glow-error font-mono text-xl font-bold tracking-[0.3em] text-terminal-error">
                  CAUGHT
                </div>
                <p className="mt-2 font-mono text-[11px] tabular-nums text-terminal-text-dim">
                  {view
                    ? `survived ${view.seconds.toFixed(0)}s · ${view.typedChars}m escaped · ${view.errors} slips`
                    : ''}
                </p>
                <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={start}>
                  ▶ RUN AGAIN
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
