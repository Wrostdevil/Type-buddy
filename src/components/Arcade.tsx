import { useCallback, useState } from 'react'
import { Invaders } from './arcade/Invaders'
import { Tracer } from './arcade/Tracer'
import { Reaction } from './arcade/Reaction'
import { Defuse } from './arcade/Defuse'
import { GhostChase } from './arcade/GhostChase'
import { Brawler } from './arcade/Brawler'
import { GhostDuel } from './arcade/GhostDuel'
import { Storm } from './arcade/Storm'
import { loadBests, saveBest } from '../lib/bests'
import type { Bests } from '../lib/bests'

type GameId =
  | 'invaders'
  | 'tracer'
  | 'pulse'
  | 'defuse'
  | 'chase'
  | 'brawler'
  | 'duel'
  | 'storm'

interface ArcadeProps {
  onClose: () => void
}

type GameDef = {
  id: GameId
  title: string
  tag: string
  blurb: string
  /** show best as score-average-ms (lower is better) */
  lowerBetter?: boolean
  bestKey: string
  unit: string
  /** training focus shown as a mini chip on the card */
  skill: string
}

const GAMES: GameDef[] = [
  {
    id: 'invaders',
    title: 'INVADERS',
    tag: 'falling words',
    skill: 'word recognition',
    blurb:
      'vocabulary bombers descend on the deck. lock each prompt and detonate before it crosses the line. three breaches and the hull is gone.',
    bestKey: 'game:invaders',
    unit: 'pts',
  },
  {
    id: 'tracer',
    title: 'TRACER',
    tag: 'race the bot',
    skill: 'sustained pace',
    blurb:
      'a trace bot decrypts the same payload at fixed speed — four difficulties up to 80 wpm. outtype it before your signal burns.',
    bestKey: 'game:tracer',
    unit: 'beaten',
  },
  {
    id: 'pulse',
    title: 'PULSE-KEY',
    tag: 'reflex drill',
    skill: 'reaction time',
    blurb:
      'ten glyphs flash one by one — strike each instantly. wrong keys cost 400 ms. trains the zero-thought connection between eye and finger.',
    lowerBetter: true,
    bestKey: 'game:pulse',
    unit: 'ms avg',
  },
  {
    id: 'defuse',
    title: 'DEFUSE',
    tag: 'bomb codes',
    skill: 'shift discipline',
    blurb:
      'codes laced with capitals, digits and symbols arrive wired to a fuse. type them exactly before detonation — wrong keys burn seconds off the clock.',
    bestKey: 'game:defuse',
    unit: 'pts',
  },
  {
    id: 'chase',
    title: 'GHOST CHASE',
    tag: 'survival glide',
    skill: 'speed under threat',
    blurb:
      'a hunter eats the gap every second of silence. land keystrokes to shove it back; slips hand it five meters. outpace the decay as long as you can.',
    bestKey: 'game:chase',
    unit: 'pts',
  },
  {
    id: 'brawler',
    title: 'WORD BRAWLER',
    tag: 'arena duel',
    skill: 'targeting + tempo',
    blurb:
      'ghosts march on your striker in single file. the nearest one is lock-red: slash it with letters before it plants and starts burning your hull.',
    bestKey: 'game:brawler',
    unit: 'pts',
  },
  {
    id: 'duel',
    title: 'GHOST DUEL',
    tag: 'race your ghost',
    skill: 'beat your PB',
    blurb:
      'the opponent is a phantom replay of your personal best from the breach archive. race it straight, or overclock it +10/+25 when beating yourself gets comfortable.',
    bestKey: 'game:duel',
    unit: 'PB',
  },
  {
    id: 'storm',
    title: 'LETTER STORM',
    tag: 'reflex rain',
    skill: 'raw strike speed',
    blurb:
      'endless glyph rain at rising speed. combos spike the score, ground strikes break the chain. amber glyphs need shift. how deep can you last?',
    bestKey: 'game:storm',
    unit: 'pts',
  },
]

function GameCard({
  def,
  bests,
  onPlay,
}: {
  def: GameDef
  bests: Bests
  onPlay: () => void
}) {
  const best = bests[def.bestKey]
  return (
    <button
      type="button"
      onClick={onPlay}
      className="win scan-lines group relative flex flex-col p-3 text-left transition-colors hover:border-terminal-accent/50"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="font-mono text-[13px] font-bold tracking-[0.25em] text-terminal-text group-hover:text-terminal-accent glow"
        >
          {def.title}
        </span>
        <span className="border border-terminal-border px-1.5 py-0.5 font-mono text-[8px] tracking-[0.2em] text-terminal-text-dim">
          {def.tag}
        </span>
      </div>
      <p className="mt-2 font-mono text-[10px] leading-snug text-terminal-text-dim">
        {def.blurb}
      </p>
      <div className="mt-2 font-mono text-[8px] tracking-[0.25em] text-terminal-accent/60">
        ▸ trains: {def.skill}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-terminal-border/60 pt-2 font-mono text-[9px] tabular-nums text-terminal-text-dim">
        <span>
          best{' '}
          <span className="text-terminal-accent">
            {best !== undefined ? `${best}` : '—'}
          </span>{' '}
          {best !== undefined ? def.unit : ''}
        </span>
        <span className="tracking-[0.2em] text-terminal-accent/70 group-hover:animate-pulse">
          ▶ INSERT
        </span>
      </div>
    </button>
  )
}

function BackLink({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="font-mono text-[10px] tracking-[0.3em] text-terminal-text-dim hover:text-terminal-accent"
    >
      &lt;&lt; RETURN TO BREACH / esc
    </button>
  )
}

/**
 * The arcade takeover: a game hall with persistent high scores, launching
 * each drill full width. Games own their input while running.
 */
export function Arcade({ onClose }: ArcadeProps) {
  const [game, setGame] = useState<GameId | null>(null)
  // localStorage read is synchronous + cheap → init directly at mount
  const [bests, setBests] = useState<Bests>(() => loadBests())
  // touch-only devices have no hardware keyboard — warn once, nicely
  const [coarse] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches &&
      !window.matchMedia('(any-pointer: fine)').matches,
  )

  // stable reporter: reads the vault fresh instead of closing over `bests`,
  // so game handlers don't churn (which would reset in-game timers)
  const report = useCallback(
    (bestKey: string, value: number, higherBetter: boolean): void => {
      if (higherBetter) {
        if (value > (loadBests()[bestKey] ?? 0)) saveBest(bestKey, value)
      } else {
        const cur = loadBests()[bestKey]
        if (cur === undefined || value < cur) saveBest(bestKey, value)
      }
      setBests(loadBests())
    },
    [],
  )

  const handleInvaders = useCallback(
    (score: number) => report('game:invaders', score, true),
    [report],
  )
  const handleTracer = useCallback(
    (botWpm: number, won: boolean) => {
      if (won) report('game:tracer', botWpm, true)
    },
    [report],
  )
  const handlePulse = useCallback(
    (avgMs: number) => report('game:pulse', avgMs, false),
    [report],
  )
  const handleDefuse = useCallback(
    (score: number) => report('game:defuse', score, true),
    [report],
  )
  const handleChase = useCallback(
    (score: number) => report('game:chase', score, true),
    [report],
  )
  const handleBrawler = useCallback(
    (score: number) => report('game:brawler', score, true),
    [report],
  )
  const handleDuel = useCallback(
    (ghostWpm: number, won: boolean) => {
      if (won) report('game:duel', ghostWpm, true)
    },
    [report],
  )
  const handleStorm = useCallback(
    (score: number) => report('game:storm', score, true),
    [report],
  )

  const def = game ? GAMES.find((g) => g.id === game) ?? null : null

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-mono text-sm tracking-[0.3em] text-terminal-accent glow">
            SIGNAL ARCADE
          </h2>
          <p className="mt-1 max-w-2xl font-mono text-[11px] leading-relaxed text-terminal-text-dim">
            {GAMES.length} cabinets, each one converting raw keystrokes into
            combat telemetry — practice masquerading as play. scores persist
            in the vault.
          </p>
          {coarse && (
            <p className="mt-2 max-w-2xl border border-terminal-warning/50 bg-terminal-warning/5 px-2 py-1 font-mono text-[10px] leading-snug text-terminal-warning">
              ⌨ touch screen detected — the cabinets are wired to a hardware
              keyboard and need one to play.
            </p>
          )}
        </div>
        <BackLink onClose={onClose} />
      </div>

      {!def && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((g) => (
            <GameCard key={g.id} def={g} bests={bests} onPlay={() => setGame(g.id)} />
          ))}
        </div>
      )}

      {def && (
        <div>
          <div className="mb-2 flex items-center justify-between font-mono text-[10px] tracking-[0.25em] text-terminal-text-dim">
            <span className="text-terminal-accent glow">{def.title}</span>
            <button type="button" className="hover:text-terminal-text" onClick={() => setGame(null)}>
              ◄ CABINET MENU
            </button>
          </div>
          {def.id === 'invaders' && <Invaders onScore={handleInvaders} />}
          {def.id === 'tracer' && <Tracer onResult={handleTracer} />}
          {def.id === 'pulse' && <Reaction onScore={handlePulse} />}
          {def.id === 'defuse' && <Defuse onScore={handleDefuse} />}
          {def.id === 'chase' && <GhostChase onScore={handleChase} />}
          {def.id === 'brawler' && <Brawler onScore={handleBrawler} />}
          {def.id === 'duel' && <GhostDuel onResult={handleDuel} />}
          {def.id === 'storm' && <Storm onScore={handleStorm} />}
        </div>
      )}
    </div>
  )
}
