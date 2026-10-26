import { useCallback, useEffect, useRef, useState } from 'react'
import { COMMON_WORDS } from '../../lib/words'
import { playKeySound } from '../../lib/sound'

type Phase = 'menu' | 'running' | 'win' | 'lose'

const DIFFICULTIES: Array<{ label: string; wpm: number }> = [
  { label: 'CADET — 20 wpm', wpm: 20 },
  { label: 'AGENT — 40 wpm', wpm: 40 },
  { label: 'OPERATIVE — 60 wpm', wpm: 60 },
  { label: 'PHANTOM — 80 wpm', wpm: 80 },
]

function makePassage(): string {
  const out: string[] = []
  for (let i = 0; i < 34; i++) {
    out.push(COMMON_WORDS[(Math.random() * COMMON_WORDS.length) | 0])
  }
  return out.join(' ')
}

interface RunState {
  passage: string
  pos: number
  errors: number
  botWpm: number
  startedAt: number
  botChars: number
  wpm: number
}

const NULL_RUN: RunState = {
  passage: '',
  pos: 0,
  errors: 0,
  botWpm: 0,
  startedAt: 0,
  botChars: 0,
  wpm: 0,
}

/**
 * TRACER — a trace bot is decrypting the same payload at a fixed rate.
 * Outtype it before your signal is burned. Wrong keys don't advance,
 * they just cost you time.
 *
 * Input mutates an internal ref and publishes snapshots to state; the
 * render tree reads state only.
 */
export function Tracer({ onResult }: { onResult: (botWpm: number, won: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>('menu')
  const [difficulty, setDifficulty] = useState(1)
  const [run, setRun] = useState<RunState>(NULL_RUN)
  const runRef = useRef<RunState>(NULL_RUN)
  const passageDisplayRef = useRef<HTMLDivElement>(null)

  const publish = useCallback(() => {
    setRun({ ...runRef.current })
  }, [])

  const start = useCallback(() => {
    const fresh: RunState = {
      passage: makePassage(),
      pos: 0,
      errors: 0,
      botWpm: DIFFICULTIES[difficulty].wpm,
      startedAt: 0,
      botChars: 0,
      wpm: 0,
    }
    runRef.current = fresh
    setRun({ ...fresh })
    setPhase('running')
  }, [difficulty])

  // while live, the game owns the keyboard (blocks app-level esc navigation)
  useEffect(() => {
    if (phase !== 'running') return
    document.body.dataset.gameCapture = '1'
    return () => {
      delete document.body.dataset.gameCapture
    }
  }, [phase])

  // bot progress + finish watch, driven by wall-clock
  useEffect(() => {
    if (phase !== 'running') return
    const id = window.setInterval(() => {
      const r = runRef.current
      if (!r.startedAt) return
      const elapsed = (Date.now() - r.startedAt) / 1000
      r.botChars = (r.botWpm * 5 * elapsed) / 60
      const playerMin = elapsed / 60
      r.wpm = r.pos > 0 ? Math.round(r.pos / 5 / playerMin) : 0
      publish()

      if (r.botChars >= r.passage.length) {
        onResult(r.botWpm, false)
        setPhase('lose')
      }
      // keep the caret visible
      passageDisplayRef.current?.querySelector('[data-caret]')?.scrollIntoView({ block: 'nearest' })
    }, 100)
    return () => window.clearInterval(id)
  }, [phase, publish, onResult])

  // input: letters/space advance only on correct chars
  useEffect(() => {
    if (phase !== 'running') return
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const r = runRef.current
      if (e.key === 'Escape') {
        setPhase('menu')
        return
      }
      if (e.key.length !== 1) return
      if (!r.startedAt) r.startedAt = Date.now()
      e.preventDefault()
      if (e.key === r.passage[r.pos]) {
        r.pos += 1
        playKeySound({ kind: 'char', correct: true })
        if (r.pos >= r.passage.length) {
          publish()
          onResult(r.botWpm, true)
          setPhase('win')
          return
        }
      } else {
        r.errors += 1
        playKeySound({ kind: 'char', correct: false })
      }
      publish()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, publish, onResult])

  const passageLen = run.passage.length
  const playerPct = passageLen ? (run.pos / passageLen) * 100 : 0
  const botPct = passageLen ? (Math.min(run.botChars, passageLen) / passageLen) * 100 : 0

  return (
    <div className="flex flex-col gap-3">
      {/* racetrack */}
      <div className="border border-terminal-border bg-terminal-bg p-3">
        <div className="mb-2 flex items-center justify-between font-mono text-[9px] tracking-[0.25em] text-terminal-text-dim">
          <span>YOU · {Math.round(playerPct)}%</span>
          <span>
            TRACE BOT · {run.botWpm} wpm · {Math.round(botPct)}%
          </span>
        </div>
        {/* player lane */}
        <div className="mb-1 flex items-center gap-2">
          <span className="w-11 shrink-0 font-mono text-[9px] text-terminal-accent">YOU</span>
          <div className="h-2.5 flex-1 border border-terminal-border/70 bg-terminal-bg/70 p-px">
            <div className="h-full bg-terminal-accent transition-[width] duration-100" style={{ width: `${playerPct}%` }} />
          </div>
        </div>
        {/* bot lane */}
        <div className="flex items-center gap-2">
          <span className="w-11 shrink-0 font-mono text-[9px] text-terminal-error">BOT</span>
          <div className="h-2.5 flex-1 border border-terminal-border/70 bg-terminal-bg/70 p-px">
            <div className="h-full bg-terminal-error transition-[width] duration-100" style={{ width: `${botPct}%` }} />
          </div>
        </div>
      </div>

      {phase === 'running' ? (
        <>
          {/* payload */}
          <div
            ref={passageDisplayRef}
            className="scrollbar-hide max-h-36 overflow-y-auto border border-terminal-border bg-terminal-bg p-4 font-mono text-[15px] leading-7"
            aria-hidden
          >
            <span className="text-terminal-accent">{run.passage.slice(0, run.pos)}</span>
            <span data-caret className="caret" />
            <span className="text-terminal-text-dim">{run.passage.slice(run.pos)}</span>
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] text-terminal-text-dim">
            <span>
              wpm <span className="tabular-nums text-terminal-accent">{run.wpm}</span>
              <span className="ml-3">
                errors <span className="tabular-nums text-terminal-error">{run.errors}</span>
              </span>
            </span>
            <span>esc abort</span>
          </div>
        </>
      ) : (
        <div className="win scan-lines grid place-items-center p-6 text-center" style={{ minHeight: 180 }}>
          {phase === 'menu' ? (
            <div className="max-w-md">
              <div className="glow font-mono text-xl font-bold tracking-[0.3em] text-terminal-accent">
                TRACER
              </div>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-terminal-text-dim">
                the trace bot decrypts the same 34-word payload at fixed speed.
                reach the end before it does — wrong keys never advance, they
                only burn time. pick your opponent:
              </p>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {DIFFICULTIES.map((d, i) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => setDifficulty(i)}
                    className={`btn border px-2 py-1.5 font-mono text-[10px] ${
                      difficulty === i
                        ? 'border-terminal-accent bg-terminal-accent/15 text-terminal-accent'
                        : 'border-terminal-border text-terminal-text-dim hover:text-terminal-text'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={start}>
                ▶ MATCH START
              </button>
            </div>
          ) : phase === 'win' ? (
            <div className="max-w-md">
              <div className="glow font-mono text-xl font-bold tracking-[0.3em] text-terminal-accent">
                PAYLOAD SECURED
              </div>
              <p className="mt-2 font-mono text-[11px] text-terminal-text-dim">
                you outtyped the {run.botWpm} wpm bot with {run.errors} slips.
              </p>
              <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={start}>
                ▶ NEXT MATCH
              </button>
            </div>
          ) : (
            <div className="max-w-md">
              <div className="glow-error font-mono text-xl font-bold tracking-[0.3em] text-terminal-error">
                SIGNAL BURNED
              </div>
              <p className="mt-2 font-mono text-[11px] text-terminal-text-dim">
                the bot finished first. drill the lessons and return — phantom
                waits for no one.
              </p>
              <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={start}>
                ▶ REMATCH
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
