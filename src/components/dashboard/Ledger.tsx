import { useEffect, useRef, useState } from 'react'
import { mulberry32 } from './canvasUtil'
import { playKeySound } from '../../lib/sound'
import type { TestState } from '../../lib/engine'

interface LedgerProps {
  state: TestState
  onRestart: () => void
  onSwapMode: () => void
  onToggleSound: () => void
}

interface Row {
  id: number
  tag: string
  hexCol: string
  msg: string
  tone: 'dim' | 'accent' | 'warning' | 'error'
}

const MAX_ROWS = 26

const NOISERS: Array<() => string> = [
  () => `keepalive ok · hop${(Math.random() * 3 | 0) + 1} stable`,
  () => `fingerprint rotated f${Math.floor(Math.random() * 0xfff).toString(16)}`,
  () => `entropy pool topped off · ${Math.floor(Math.random() * 4096)} bits`,
  () => `relay nomad-0${Math.ceil(Math.random() * 8)} attached · rtt ${Math.floor(Math.random() * 90) + 20}ms`,
  () => `sniffing handshake segments… ${Math.floor(Math.random() * 9999)} captured`,
  () => `chunk committed · ${Math.floor(Math.random() * 64)} bytes${' · sha ok'}`,
  () => `checkpoint ${Math.random().toString(16).slice(2, 8)} acked`,
]

const ERRORS: Array<() => string> = [
  () => `checksum mismatch · resending segment ${Math.random().toString(16).slice(2, 6)}`,
  () => `packet corrupted mid-transit · parity restored`,
  () => `firewall probe deflected · port ${Math.floor(Math.random() * 64000) + 1024} closed`,
  () => `signature anomaly · isolating buffer`,
]

const fresh = (): string => {
  const r = mulberry32(Math.floor(Math.random() * 0xffffffff))
  const hexc = (n: number): string => {
    let s = ''
    for (let i = 0; i < n; i++) s += `0123456789ABCDEF`[Math.floor(r() * 16)]
    return s
  }
  return hexc(32)
}

const click = (): void => playKeySound({ kind: 'space', correct: true })

/**
 * The tall operator ledger (bottom-right window in the reference): fixed
 * header (target / file + traffic lights buttons) and a streaming dump of
 * payload events chained to the typing engine — one row per committed word.
 */
export function Ledger({ state, onRestart, onSwapMode, onToggleSound }: LedgerProps) {
  const [rows, setRows] = useState<Row[]>([])
  const [ip] = useState(() => `192.145.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`)
  const rowId = useRef(0)
  const bootAt = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prev = useRef({ startedAt: null as number | null, index: 0, errors: 0, finished: false })

  const push = (msg: string, tone: Row['tone']) => {
    const stamp = Math.max(0, (Date.now() - bootAt.current) / 1000)
    const tag = `T+${stamp.toFixed(1).padStart(5, '0')}`
    const hexCol = fresh().slice(0, 8)
    setRows((cur) => [...cur.slice(-(MAX_ROWS - 1)), { id: rowId.current++, tag, hexCol, msg, tone }])
  }

  useEffect(() => {
    bootAt.current = Date.now()
    push('uplink locked · 3 hops', 'accent')
    push('cloaking profile armed', 'dim')
    const id = window.setInterval(() => {
      push(NOISERS[(Math.random() * NOISERS.length) | 0](), 'dim')
    }, 3600)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // engine reactions
  useEffect(() => {
    const before = prev.current
    if (state.startedAt && !before.startedAt) push('breach initiated · target locked', 'accent')
    if (state.index > before.index) {
      const word = state.words[state.index - 1] ?? ''
      const ok = (state.typed[state.index - 1] ?? '') === word
      push(
        ok
          ? `decrypt "${word}" · ${word.length}b exfil`
          : `decrypt "${word}" FAILED · buffer resync`,
        ok ? 'accent' : 'warning',
      )
    }
    if (state.errorsTotal > before.errors) {
      push(ERRORS[(Math.random() * ERRORS.length) | 0](), 'error')
    }
    if (state.finished && !before.finished) push('breach complete · session archived', 'accent')
    prev.current = {
      startedAt: state.startedAt,
      index: state.index,
      errors: state.errorsTotal,
      finished: state.finished,
    }
  }, [state])

  // stick to the newest rows
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [rows])

  const toneClass = (tone: Row['tone']): string =>
    tone === 'error'
      ? 'text-terminal-error'
      : tone === 'warning'
        ? 'text-terminal-warning'
        : tone === 'accent'
          ? 'text-terminal-accent/90'
          : 'text-terminal-text-dim'

  const mini = 'flex-1 border border-terminal-accent/30 bg-terminal-panel px-1 py-0.5 font-mono text-[8px] tracking-[0.15em] text-terminal-text-dim hover:border-terminal-accent/60 hover:text-terminal-accent active:bg-terminal-accent/20'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* header like the reference: target/file stack */}
      <div className="space-y-0.5 border-b border-terminal-border bg-terminal-panel/50 px-2 py-1.5 font-mono text-[9px]">
        <div className="flex justify-between text-terminal-text">
          <span className="text-terminal-text-dim">Target</span>
          <span className="text-terminal-accent">{ip}</span>
        </div>
        <div className="flex justify-between text-terminal-text">
          <span className="text-terminal-text-dim">File</span>
          <span className="truncate">/C:/@data/min/new/target</span>
        </div>
      </div>
      {/* traffic-light action buttons */}
      <div className="flex gap-1 border-b border-terminal-border/60 p-1">
        <button
          type="button"
          className={mini}
          onClick={() => {
            click()
            onRestart()
          }}
          title="new target (tab)"
        >
          WIPE
        </button>
        <button
          type="button"
          className={mini}
          onClick={() => {
            click()
            onSwapMode()
          }}
          title="swap mode"
        >
          SWAP
        </button>
        <button
          type="button"
          className={mini}
          onClick={() => {
            click()
            onToggleSound()
          }}
          title="signal audio"
        >
          SND
        </button>
      </div>
      {/* streaming dump */}
      <div ref={scrollRef} className="ledger-scroll min-h-0 flex-1 overflow-y-auto px-2 py-1 font-mono text-[9px] leading-[1.5]">
        {rows.map((r) => (
          <div key={r.id} className="flex animate-fade-in gap-1.5 whitespace-nowrap">
            <span className="text-terminal-text-dim/50">{r.tag}</span>
            <span className="text-terminal-text-dim/70">{r.hexCol}</span>
            <span className={`truncate ${toneClass(r.tone)}`}>{r.msg}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
