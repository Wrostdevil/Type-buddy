import { useEffect, useMemo, useState } from 'react'

export type View = 'breach' | 'lessons' | 'arcade' | 'archive'

interface SysBarProps {
  view: View
  onViewChange: (view: View) => void
  sound: boolean
  onToggleSound: () => void
  /** live telemetry wired into the mission ticker */
  status: {
    breach: number
    wpm: number
    trace: number
    running: boolean
  }
}

const NAV_ITEMS: Array<{ id: View; label: string; glyph: string }> = [
  { id: 'breach', label: 'BREACH', glyph: '▚' },
  { id: 'lessons', label: 'LESSONS', glyph: '◈' },
  { id: 'arcade', label: 'ARCADE', glyph: '▶' },
  { id: 'archive', label: 'ARCHIVE', glyph: '▤' },
]

const FLAVOR: string[] = [
  'visual nine v9 online — photonic core nominal',
  'watch the hands, not the board — anchors stay f and j',
  'trace risk follows errors: type clean, stay invisible',
  'relay nomad-04 handshake verified · rtt nominal',
  'lesson VI targets 24 wpm at 92% accuracy',
  'entropy pool replenished from hardware rng',
  'sat-θ telemetry locked · downlink green',
  'the backspace is also a key — use it, don\u2019t fear it',
  'finished drills archive to the ledger automatically',
  'distraction filters engaged · quiet-room protocol',
  'arcade invaders pays score per letter destroyed',
  'trace bot difficulty is set inside the arcade',
]

const pad = (n: number): string => `${n}`.padStart(2, '0')

function upclock(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

function wallclock(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * The command deck — the very top of the app. A glitching ops logo, a
 * scrolling mission ticker interleaving live telemetry with rotating
 * flavour alerts, wall clock + session uptime, and the four-way view nav.
 */
export function SysBar({ view, onViewChange, sound, onToggleSound, status }: SysBarProps) {
  const [node] = useState(() =>
    Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, '0'),
  )
  const [clock, setClock] = useState(wallclock)
  const [uptime, setUptime] = useState(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(wallclock())
      setUptime((u) => u + 1)
      setTick((t) => t + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // ticker line: telemetry + a rotating flavour phrase, re-rolling every 8s
  const tickerLine = useMemo(() => {
    const flavor = [FLAVOR[tick % FLAVOR.length], FLAVOR[(tick * 3 + 4) % FLAVOR.length]]
    const telemetry = [
      `UP ${upclock(uptime)}`,
      status.running ? `BREACH ${status.breach}%` : 'UP-link idle',
      `WPM ${Math.round(status.wpm)}`,
      `TRACE ${Math.round(status.trace)}%`,
      `NODE 0x${node}`,
      sound ? 'AUDIO hot' : 'AUDIO muted',
    ]
    const phrases = [...telemetry, ...flavor]
    return phrases.join('   ◆   ') + '   ◆   '
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, status.breach, status.wpm, status.trace, status.running, sound, node, uptime])

  const navBtn = (item: (typeof NAV_ITEMS)[number]): string =>
    `border px-1.5 py-2.5 font-mono text-[10px] tracking-[0.18em] transition-colors sm:px-2 sm:py-1 ${
      view === item.id
        ? 'border-terminal-accent/60 bg-terminal-accent/15 text-terminal-accent glow'
        : 'border-terminal-border/70 text-terminal-text-dim hover:border-terminal-accent/40 hover:text-terminal-text'
    }`

  return (
    <header className="relative z-20 border-b border-terminal-border bg-terminal-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center gap-x-3 gap-y-1.5 px-2 py-1.5 sm:px-3 sm:py-2">
        {/* glitching ops mark */}
        <div className="glitch-logo shrink-0 select-none" data-text="GH0ST.OPS">
          <span aria-hidden className="glitch-layer g1">GH0ST.OPS</span>
          <span aria-hidden className="glitch-layer g2">GH0ST.OPS</span>
          GH0ST.OPS
        </div>
        <span className="hidden font-mono text-[9px] leading-3 text-terminal-text-dim xl:block">
          breach division
          <br />
          visual nine v9
        </span>

        {/* mission ticker */}
        <div className="order-last min-w-0 flex-1 basis-full overflow-hidden border border-terminal-border/50 bg-terminal-bg/60 py-0.5 sm:order-none sm:basis-auto">
          <div className="relative h-3.5 overflow-hidden sm:h-4">
            <div
              className="mission-ticker absolute top-0 w-max whitespace-nowrap font-mono text-[9px] leading-4 text-terminal-text-dim"
            >
              <span className="pr-24">{tickerLine}</span>
              <span className="pr-24">{tickerLine}</span>
            </div>
          </div>
        </div>

        <span className="hidden font-mono text-[10px] tabular-nums text-terminal-text-dim sm:inline">
          {clock}
        </span>

        {/* nav — single row, scrollable on tiny screens */}
        <nav className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} type="button" className={`${navBtn(item)} shrink-0`} onClick={() => onViewChange(item.id)}>
              <span className="mr-1 text-[9px] opacity-80">{item.glyph}</span>
              {item.label}
            </button>
          ))}
          <button
            type="button"
            title={`signal audio ${sound ? 'on' : 'off'} — click to toggle`}
            onClick={onToggleSound}
            className="ml-1 shrink-0 cursor-pointer border border-transparent px-1"
          >
            <span className={`net-dot ${sound ? 'animate-pulse' : 'opacity-30'}`} />
          </button>
        </nav>
      </div>
    </header>
  )
}
