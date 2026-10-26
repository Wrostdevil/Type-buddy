import { useEffect, useState } from 'react'
import { liveStats } from '../lib/engine'
import type { TestConfig, TestState } from '../lib/engine'

interface SystemHudProps {
  state: TestState
  config: TestConfig
}

interface Metric {
  label: string
  value: string
  /** 0..100 for the mini bar */
  pct: number
  tone: 'accent' | 'warning' | 'error' | 'dim'
}

const rand = (min: number, max: number): number => min + Math.random() * (max - min)

const hex = (digits: number): string =>
  Math.floor(Math.random() * 16 ** digits)
    .toString(16)
    .toUpperCase()
    .padStart(digits, '0')

/**
 * Fake "breach in progress" telemetry strip. A few real parameters
 * (keys typed, breach progress) are mixed with jittering system stats so
 * the dashboard feels alive — and reacts when you start hammering keys.
 */
export function SystemHud({ state, config }: SystemHudProps) {
  const [tick, setTick] = useState(0)
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    const boot = window.setTimeout(() => setBooted(true), 1300)
    const slow = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = window.setInterval(() => setTick((t) => t + 1), slow ? 700 : 150)
    return () => {
      window.clearTimeout(boot)
      window.clearInterval(id)
    }
  }, [])

  if (!booted) {
    return (
      <div className="panel scan-lines flex items-center justify-center gap-2 px-3 py-3 font-mono text-[11px] text-terminal-text-dim">
        <span className="net-dot animate-pulse" />
        <span className="tracking-[0.25em]">establishing uplink…</span>
      </div>
    )
  }

  const live = liveStats(state)
  const running = state.startedAt !== null && !state.finished
  const keys = state.chars.correct + state.chars.incorrect
  const progress =
    config.mode === 'time'
      ? Math.min(100, (live.elapsed / config.timeLimit) * 100)
      : Math.min(100, (state.index / Math.max(1, state.words.length || config.wordCount)) * 100)
  const threat = Math.min(99, state.errorsTotal * 9 + (running ? rand(0, 14) : rand(0, 4)))
  const energy = running ? rand(58, 96) : rand(9, 22)

  const metrics: Metric[] = [
    { label: 'cpu', value: `${Math.round(energy)}%`, pct: energy, tone: running ? 'accent' : 'dim' },
    { label: 'mem', value: `${Math.round(rand(58, 67) + (running ? 4 : 0))}%`, pct: 62, tone: 'dim' },
    { label: 'net', value: `${Math.round(rand(14, 64))}ms`, pct: 40, tone: running ? 'accent' : 'dim' },
    {
      label: 'pkt/s',
      value: `${Math.round(running ? rand(140, 520) : rand(36, 80))}`,
      pct: running ? 82 : 22,
      tone: 'dim',
    },
    { label: 'keys', value: `${keys}`, pct: 0, tone: 'accent' },
    { label: 'breach', value: `${Math.round(progress)}%`, pct: progress, tone: 'accent' },
    {
      label: 'trace',
      value: `${Math.round(threat)}%`,
      pct: threat,
      tone: threat > 45 ? 'error' : threat > 22 ? 'warning' : 'dim',
    },
  ]

  return (
    <div className="panel scan-lines overflow-hidden" data-tick={tick % 2}>
      <div className="grid grid-cols-3 divide-x divide-terminal-border sm:grid-cols-4 lg:grid-cols-7">
        {metrics.map((m) => (
          <div key={m.label} className="px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-terminal-text-dim">
              {m.label}
            </div>
            <div
              className={`font-mono text-sm tabular-nums leading-5 ${
                m.tone === 'error'
                  ? 'glow-error text-terminal-error'
                  : m.tone === 'warning'
                    ? 'text-terminal-warning'
                    : m.tone === 'accent'
                      ? 'glow text-terminal-accent'
                      : 'text-terminal-text'
              }`}
            >
              {m.value}
            </div>
            <div className="mt-1 h-0.5 w-full bg-terminal-border">
              <div
                className={`h-full transition-[width] duration-150 ${
                  m.tone === 'error'
                    ? 'bg-terminal-error'
                    : m.tone === 'warning'
                      ? 'bg-terminal-warning'
                      : 'bg-terminal-accent'
                }`}
                style={{ width: `${Math.max(2, Math.min(100, m.pct))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-terminal-border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-terminal-text-dim">
        <span className="flex items-center gap-1.5">
          <span className="net-dot animate-pulse" />
          {running ? 'uplink: live · muscle-memory heist' : 'uplink: idle · listening'}
        </span>
        <span className="hidden sm:inline">relay 0x{hex(4)} · aes-256 · 3 hops</span>
      </div>
    </div>
  )
}
