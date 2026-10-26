import { useLayoutEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import { liveStats } from '../lib/engine'
import type { TestConfig, TestState } from '../lib/engine'

/** word height (h-9 = 36px) + row gap (gap-y-3 = 12px) */
const LINE_PITCH = 48

interface TypeTestProps {
  state: TestState
  config: TestConfig
  blurred: boolean
  onRestart: () => void
}

function Word({
  target,
  typed,
  active,
  wordRef,
}: {
  target: string
  typed: string
  active: boolean
  wordRef: RefObject<HTMLDivElement | null> | undefined
}) {
  const wrong = !active && typed.length > 0 && typed !== target
  const positions = Math.max(target.length, typed.length)

  const nodes: ReactNode[] = []
  for (let p = 0; p < positions; p++) {
    const typedChar = typed[p]
    const targetChar = target[p]
    let className: string
    let char: string
    if (typedChar !== undefined) {
      if (typedChar === targetChar) {
        className = 'text-terminal-text'
        char = targetChar
      } else if (targetChar !== undefined) {
        className =
          'text-terminal-error underline decoration-terminal-error/60 decoration-1'
        char = targetChar
      } else {
        className = 'text-terminal-error/70'
        char = typedChar
      }
    } else {
      className = 'text-terminal-text-dim'
      char = targetChar
    }
    nodes.push(
      <span key={p} className={className}>
        {char}
      </span>,
    )
  }

  return (
    <div
      ref={wordRef}
      className={`flex h-9 items-center whitespace-pre px-1 font-mono text-xl leading-none transition-colors sm:text-2xl ${
        wrong ? 'border-b-2 border-terminal-error/50' : 'border-b-2 border-transparent'
      }`}
    >
      {nodes.slice(0, typed.length)}
      {active && <span className="caret" />}
      {nodes.slice(typed.length)}
    </div>
  )
}

export function TypeTest({ state, config, blurred, onRestart }: TypeTestProps) {
  const activeRef = useRef<HTMLDivElement | null>(null)
  const [offset, setOffset] = useState(0)
  const [coarse] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches &&
      !window.matchMedia('(any-pointer: fine)').matches,
  )

  // keep the active line centered: never scroll past the first visible line
  useLayoutEffect(() => {
    const el = activeRef.current
    if (!el) return
    const line = Math.round(el.offsetTop / LINE_PITCH)
    setOffset(Math.max(0, line - 1) * LINE_PITCH)
  }, [state.index, state.words])

  const live = liveStats(state)
  const started = state.startedAt !== null
  const remaining = Math.max(0, config.timeLimit - Math.floor(live.elapsed))
  const visibleWords =
    config.mode === 'words' ? state.words.length : state.index + 80

  return (
    <div>
      {/* live stats row */}
      <div className="flex items-center justify-between px-1 pb-3 font-mono text-sm">
        <div className="flex items-center gap-3 sm:gap-5">
          <span className="text-xl font-semibold tabular-nums text-terminal-accent sm:text-2xl">
            {config.mode === 'time'
              ? remaining
              : `${state.index}/${config.wordCount}`}
          </span>
          <span className="text-terminal-text-dim">
            wpm{' '}
            <span className="tabular-nums text-terminal-text">
              {started ? Math.round(live.wpm) : '—'}
            </span>
          </span>
          <span className="text-terminal-text-dim">
            acc{' '}
            <span className="tabular-nums text-terminal-text">
              {started ? `${Math.round(live.acc)}%` : '—'}
            </span>
          </span>
        </div>
        <button
          type="button"
          className="btn-ghost px-2 py-1"
          title="restart (esc)"
          onClick={onRestart}
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* words area */}
      <div className="relative select-none">
        <div className="relative h-36 overflow-hidden">
          <div
            className="flex flex-wrap content-start gap-x-3 gap-y-3 transition-transform duration-100"
            style={{ transform: `translateY(-${offset}px)` }}
          >
            {state.words.slice(0, visibleWords).map((word, wi) => (
              <Word
                key={`${wi}-${word}`}
                target={word}
                typed={state.typed[wi] ?? ''}
                active={wi === state.index}
                wordRef={wi === state.index ? activeRef : undefined}
              />
            ))}
          </div>
        </div>

        {!started && !blurred && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 animate-fade-in text-center font-mono text-[10px] text-terminal-text-dim sm:text-xs">
            <span className="text-terminal-accent">&gt;</span>{' '}
            {coarse ? (
              <span>touch screens can't fire keystrokes — open on a device with a keyboard</span>
            ) : (
              <span>
                type to initiate breach — tab aborts
              </span>
            )}
          </div>
        )}

        {blurred && (
          <div className="absolute inset-0 z-10 grid animate-fade-in place-items-center bg-terminal-bg/80 font-mono text-sm text-terminal-text-dim backdrop-blur-sm">
            focus lost — click to resume breach
          </div>
        )}
      </div>
    </div>
  )
}
