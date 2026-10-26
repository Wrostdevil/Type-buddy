import { useState } from 'react'

/**
 * Row of deco typography between the ticker windows, and the round V9
 * relay badge — doubling as the sound mute control.
 */
export function VisNine() {
  return (
    <div className="flex items-center justify-center py-0.5 font-mono text-[10px] font-bold tracking-[0.35em] text-terminal-accent/80">
      <span className="glow" style={{ transform: 'scaleY(1.3)' }}>
        VISUAL NINE v9
      </span>
    </div>
  )
}

export function V9Badge({ muted, onToggle }: { muted: boolean; onToggle: () => void }) {
  const [pulse, setPulse] = useState(false)
  return (
    <button
      type="button"
      title="toggle signal audio"
      onClick={() => {
        setPulse(true)
        window.setTimeout(() => setPulse(false), 320)
        onToggle()
      }}
      className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-terminal-accent/70 bg-terminal-bg transition-transform active:scale-90"
    >
      <span
        className={`pointer-events-none absolute inset-0 rounded-full border border-terminal-accent/50 ${
          pulse ? 'v9-ring' : 'opacity-0'
        }`}
      />
      <span
        className={`font-mono text-[11px] font-bold tracking-widest ${muted ? 'text-terminal-text-dim' : 'glow text-terminal-accent'}`}
      >
        V9
      </span>
    </button>
  )
}
