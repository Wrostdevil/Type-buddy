import { useMemo } from 'react'

const HEXSET = '0123456789ABCDEF'

function chunk(): string {
  let s = ''
  for (let i = 0; i < 4; i++) {
    s += HEXSET[(Math.random() * 16) | 0]
  }
  return s
}

function stream(len: number): string {
  const parts: string[] = []
  for (let i = 0; i < len; i++) {
    parts.push(chunk() + ':' + chunk())
  }
  return parts.join('  ')
}

interface TickerWindowProps {
  seed: number
  /** seconds for one full lap of the content loop */
  speed?: number
}

/**
 * Endless data tape: duplicated content + CSS translateX loop = a
 * seamless marquee of pseudo packet dumps.
 */
export function TickerWindow({ seed, speed = 26 }: TickerWindowProps) {
  // generate once per mount; re-rolling every render would stutter the loop
  const text = useMemo(() => stream(26), [])
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-terminal-bg/60">
      <div
        data-seed={seed}
        className="ticker-line absolute top-1/2 w-max -translate-y-1/2 whitespace-nowrap font-mono text-[9px] leading-none text-terminal-text-dim"
        style={{ animationDuration: `${speed}s` }}
      >
        <span className="pr-6">{text}</span>
        <span className="pr-6">{text}</span>
      </div>
    </div>
  )
}
