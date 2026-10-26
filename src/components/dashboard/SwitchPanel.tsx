import { playKeySound } from '../../lib/sound'

interface SwitchPanelProps {
  sound: boolean
  onSound: (on: boolean) => void
  onInput: () => void
}

const click = (): void => playKeySound({ kind: 'space', correct: true })

function Row({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => {
        click()
        onClick()
      }}
      className="group flex items-center justify-end gap-2 px-2 py-[3px]"
    >
      <span
        className={`inline-block origin-right text-right font-mono text-[11px] font-bold tracking-[0.25em] transition-colors ${
          active ? 'text-terminal-accent' : 'text-terminal-text-dim/70'
        }`}
        style={{ transform: 'scale(1.45, 1.35)' }}
      >
        {label}
      </span>
      <span
        className={`capsule ${active ? 'capsule-on' : ''}`}
        data-state={active ? 'on' : 'off'}
      >
        <span className={`capsule-dot ${active ? 'capsule-dot-on' : ''}`} />
      </span>
    </button>
  )
}

/**
 * ON / OFF / INPUT column like the reference wallpaper.
 * - ON / OFF drive the signal audio (real state)
 * - INPUT flashes the capsule and requests a fresh target (restart)
 */
export function SwitchPanel({ sound, onSound, onInput }: SwitchPanelProps) {
  return (
    <div className="grid h-full place-items-center bg-terminal-bg/40">
      <div className="flex flex-col gap-0.5">
        <Row label="ON" active={sound} onClick={() => onSound(true)} />
        <Row label="OFF" active={!sound} onClick={() => onSound(false)} />
        <Row label="INPUT" active={false} onClick={onInput} />
      </div>
    </div>
  )
}
