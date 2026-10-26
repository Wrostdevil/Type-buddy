import { AlignLeft, AtSign, Clock, Hash, Volume2, VolumeX } from 'lucide-react'
import type { TestConfig } from '../lib/engine'

interface ModeBarProps {
  config: TestConfig
  onChange: (patch: Partial<TestConfig>) => void
  /** whether the typewriter sound is enabled */
  sound: boolean
  onToggleSound: () => void
}

const TIME_VALUES = [15, 30, 60, 120]
const WORD_VALUES = [10, 25, 50, 100]

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Clock
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-xs transition-colors ${
        active
          ? 'bg-terminal-panel text-terminal-accent'
          : 'text-terminal-text-dim hover:bg-terminal-panel hover:text-terminal-text'
      }`}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}

function ValueButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1.5 font-mono text-xs tabular-nums transition-colors ${
        active
          ? 'bg-terminal-panel text-terminal-accent'
          : 'text-terminal-text-dim hover:bg-terminal-panel hover:text-terminal-text'
      }`}
    >
      {children}
    </button>
  )
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof AtSign
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs transition-colors ${
        active
          ? 'border-terminal-accent/40 bg-terminal-panel text-terminal-accent'
          : 'border-transparent text-terminal-text-dim hover:text-terminal-text'
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  )
}

export function ModeBar({ config, onChange, sound, onToggleSound }: ModeBarProps) {
  const values =
    config.mode === 'time' ? TIME_VALUES : WORD_VALUES
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-0.5">
        <ModeButton
          active={config.mode === 'time'}
          onClick={() => onChange({ mode: 'time' })}
          icon={Clock}
          label="time"
        />
        <ModeButton
          active={config.mode === 'words'}
          onClick={() => onChange({ mode: 'words' })}
          icon={AlignLeft}
          label="words"
        />
        <span className="mx-1.5 h-5 w-px bg-terminal-border" />
        {values.map((value) => (
          <ValueButton
            key={value}
            active={
              config.mode === 'time'
                ? config.timeLimit === value
                : config.wordCount === value
            }
            onClick={() =>
              config.mode === 'time'
                ? onChange({ timeLimit: value })
                : onChange({ wordCount: value })
            }
          >
            {config.mode === 'time' ? `${value}s` : value}
          </ValueButton>
        ))}
      </div>
      <div className="flex items-center gap-0.5">
        <ToggleButton
          active={config.punctuation}
          onClick={() => onChange({ punctuation: !config.punctuation })}
          icon={AtSign}
          label="punctuation"
        />
        <ToggleButton
          active={config.numbers}
          onClick={() => onChange({ numbers: !config.numbers })}
          icon={Hash}
          label="numbers"
        />
        <ToggleButton
          active={sound}
          onClick={onToggleSound}
          icon={sound ? Volume2 : VolumeX}
          label="sound"
        />
      </div>
    </div>
  )
}
