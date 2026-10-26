import { useCallback, useEffect, useRef, useState } from 'react'
import { COMMON_WORDS } from '../../lib/words'
import { loadResults } from '../../lib/storage'
import { playKeySound } from '../../lib/sound'

type Phase = 'menu' | 'running' | 'win' | 'lose'

const LENGTHS = [25, 50] as const

interface GhostInfo {
  wpm: number
  labeled: boolean
}

interface RunState {
  passage: string
  pos: number
  errors: number
  ghostWpm: number
  ghostChars: number
  wpm: number
  startedAt: boolean | number
}

const NULL_RUN: RunState = {
  passage: '',
  pos: 0,
  errors: 0,
  ghostWpm: 0,
  ghostChars: 0,
  wpm: 0,
  startedAt: false,
}

function makePassage(words: number): string {
  const out: string[] = []
  for (let i = 0; i < words; i++) out.push(COMMON_WORDS[(Math.random() * COMMON_WORDS.length) | 0])
  return out.join(' ')
}

/**
 * GHOST DUEL — the opponent is a phantom replay of your own best speed
 * (your PB from the breach archive), with optional overclocks if beating
 * yourself became too comfortable.
 */
export function GhostDuel({ onResult }: { onResult: (ghostWpm: number, won: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>('menu')
  const [ghost, setGhost] = useState<GhostInfo>({ wpm: 35, labeled: false })
  const [overclock, setOverclock] = useState(0)
  const [length, setLength] = useState<number>(LENGTHS[0])
  const [run, setRun] = useState<RunState>(NULL_RUN)
  const [pbLoading, setPbLoading] = useState(true)
  const runRef = useRef<RunState>(NULL_RUN)
  const displayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    loadResults()
      .then((history) => {
        if (!alive) return
        const best = history.reduce((max, r) => Math.max(max, r.wpm), 0)
        if (best >= 10) {
          setGhost({ wpm: Math.round(best), labeled: true })
        } else {
          setGhost({ wpm: 35, labeled: false })
        }
        setPbLoading(false)
      })
      .catch(() => {
        if (alive) setPbLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const publish = useCallback(() => {
    setRun({ ...runRef.current })
  }, [])

  const start = useCallback(() => {
    const fresh: RunState = {
      passage: makePassage(length),
      pos: 0,
      errors: 0,
      ghostWpm: ghost.wpm + overclock,
      ghostChars: 0,
      wpm: 0,
      startedAt: false,
    }
    runRef.current = fresh
    setRun({ ...fresh })
    setPhase('running')
  }, [ghost.wpm, overclock, length])

  // while live, the game owns the keyboard
  useEffect(() => {
    if (phase !== 'running') return
    document.body.dataset.gameCapture = '1'
    return () => {
      delete document.body.dataset.gameCapture
    }
  }, [phase])

  // ghost replay + finish watch
  useEffect(() => {
    if (phase !== 'running') return
    const id = window.setInterval(() => {
      const r = runRef.current
      if (typeof r.startedAt !== 'number') return
      const elapsed = (Date.now() - r.startedAt) / 1000
      r.ghostChars = (r.ghostWpm * 5 * elapsed) / 60
      const playerMin = elapsed / 60
      r.wpm = r.pos > 0 ? Math.round(r.pos / 5 / playerMin) : 0
      publish()

      if (r.ghostChars >= r.passage.length) {
        onResult(r.ghostWpm, false)
        setPhase('lose')
      }
      displayRef.current?.querySelector('[data-caret]')?.scrollIntoView({ block: 'nearest' })
    }, 100)
    return () => window.clearInterval(id)
  }, [phase, publish, onResult])

  // input
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
      e.preventDefault()
      if (typeof r.startedAt !== 'number') r.startedAt = Date.now()
      if (e.key === r.passage[r.pos]) {
        r.pos += 1
        playKeySound({ kind: 'char', correct: true })
        if (r.pos >= r.passage.length) {
          onResult(r.ghostWpm, true)
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

  const total = run.passage.length
  const playerPct = total ? (run.pos / total) * 100 : 0
  const ghostPct = total ? (Math.min(run.ghostChars, total) / total) * 100 : 0

  return (
    <div className="flex flex-col gap-3">
      {phase === 'running' ? (
        <>
          {/* racetrack */}
          <div className="border border-terminal-border bg-terminal-bg p-2.5 sm:p-3">
            <div className="mb-2 flex items-center justify-between font-mono text-[9px] tracking-[0.25em] text-terminal-text-dim">
              <span>YOU · {Math.round(playerPct)}%</span>
              <span>
                GHOST @{run.ghostWpm} · {Math.round(ghostPct)}%
              </span>
            </div>
            <div className="mb-1 flex items-center gap-2">
              <span className="w-11 shrink-0 font-mono text-[9px] text-terminal-accent">YOU</span>
              <div className="h-2.5 flex-1 border border-terminal-border/70 bg-terminal-bg/70 p-px">
                <div className="h-full bg-terminal-accent transition-[width] duration-100" style={{ width: `${playerPct}%` }} />
              </div>
            </div>
            {/* ghost lane — dashed, replaying your best run */}
            <div className="flex items-center gap-2">
              <span className="w-11 shrink-0 font-mono text-[9px] text-terminal-text-dim">👻</span>
              <div className="h-2.5 flex-1 border border-dashed border-terminal-border/70 bg-terminal-bg/40 p-px">
                <div
                  className="h-full bg-terminal-text-dim/70 transition-[width] duration-100"
                  style={{ width: `${ghostPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* payload */}
          <div
            ref={displayRef}
            className="scrollbar-hide max-h-36 overflow-y-auto border border-terminal-border bg-terminal-bg p-3 font-mono text-[14px] leading-6 sm:text-[15px] sm:leading-7"
            aria-hidden
          >
            <span className="text-terminal-accent">{run.passage.slice(0, run.pos)}</span>
            <span data-caret className="caret" />
            <span className="text-terminal-text-dim">{run.passage.slice(run.pos)}</span>
          </div>

          <div className="flex items-center justify-between font-mono text-[10px] tabular-nums text-terminal-text-dim">
            <span>
              wpm <span className="text-terminal-accent">{run.wpm}</span>
              <span className="ml-3">
                slips <span className="text-terminal-error">{run.errors}</span>
              </span>
            </span>
            <span>esc abort</span>
          </div>
        </>
      ) : (
        <div className="win scan-lines grid place-items-center p-5 text-center sm:p-6" style={{ minHeight: 190 }}>
          {phase === 'menu' ? (
            <div className="max-w-lg">
              <div className="glow font-mono text-xl font-bold tracking-[0.3em] text-terminal-accent">
                GHOST DUEL
              </div>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-terminal-text-dim">
                {pbLoading
                  ? 'retrieving your fastest run from the archive…'
                  : ghost.labeled
                    ? `your opponent replays your personal best — ${ghost.wpm} wpm, straight from the breach archive.`
                    : 'no archive data yet — a default phantom runs at 35 wpm. clear tests to sharpen your ghost.'}
              </p>
              <div className="mt-3 flex flex-wrap items-stretch justify-center gap-1.5">
                {[
                  { label: 'PB', delta: 0 },
                  { label: 'PB +10', delta: 10 },
                  { label: 'PB +25', delta: 25 },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => setOverclock(o.delta)}
                    className={`btn border px-2.5 py-1.5 font-mono text-[10px] ${
                      overclock === o.delta
                        ? 'border-terminal-accent bg-terminal-accent/15 text-terminal-accent'
                        : 'border-terminal-border text-terminal-text-dim hover:text-terminal-text'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
                <span className="mx-1 hidden h-auto w-px bg-terminal-border sm:block" />
                {LENGTHS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLength(n)}
                    className={`btn border px-2.5 py-1.5 font-mono text-[10px] ${
                      length === n
                        ? 'border-terminal-accent bg-terminal-accent/15 text-terminal-accent'
                        : 'border-terminal-border text-terminal-text-dim hover:text-terminal-text'
                    }`}
                  >
                    {n} words
                  </button>
                ))}
              </div>
              <div className="mt-2 font-mono text-[10px] tabular-nums text-terminal-text-dim">
                ghost speed <span className="text-terminal-error">{ghost.wpm + overclock} wpm</span>
              </div>
              <button type="button" className="btn mt-3 border-terminal-accent/60 px-4 py-2" onClick={start}>
                ▶ SUMMON GHOST
              </button>
            </div>
          ) : phase === 'win' ? (
            <div className="max-w-md">
              <div className="glow font-mono text-xl font-bold tracking-[0.3em] text-terminal-accent">
                GHOST EXCEEDED
              </div>
              <p className="mt-2 font-mono text-[11px] text-terminal-text-dim">
                you outpaced the {run.ghostWpm} wpm replay with {run.errors} slips — your archive ghost just got a new template.
              </p>
              <button type="button" className="btn mt-4 border-terminal-accent/60 px-4 py-2" onClick={start}>
                ▶ NEXT DUEL
              </button>
            </div>
          ) : (
            <div className="max-w-md">
              <div className="glow-error font-mono text-xl font-bold tracking-[0.3em] text-terminal-error">
                GHOST PREVAILED
              </div>
              <p className="mt-2 font-mono text-[11px] text-terminal-text-dim">
                yesterday's speed is still the wall. run free tests, then duel the phantom again.
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
