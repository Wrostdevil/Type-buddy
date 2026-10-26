import type { ReactNode } from 'react'

/**
 * On-screen glyph set for garbled title bars (purely decorative,
 * mirrors the unreadable alien labels of the original wallpaper).
 */
const GLYPHS = [...'‼◂▾▌·►€):▮—/']

function garble(seed: number, len = 16): string {
  let s = ''
  let n = seed * 7919 + 13
  for (let i = 0; i < len; i++) {
    n = (n * 1103515245 + 12345) & 0x7fffffff
    s += GLYPHS[n % GLYPHS.length]
  }
  return s
}

interface WinProps {
  seed: number
  title?: string
  className?: string
  bodyClassName?: string
  children?: ReactNode
}

/**
 * Bare dashboard window chrome: hairline phosphor border, dark glass body,
 * garbled title bar with ◄ ► jambs. Everything on screen is built from this.
 */
export function Win({ seed, title, className = '', bodyClassName = '', children }: WinProps) {
  const label = title ?? garble(seed)
  return (
    <div
      className={`win scan-lines relative flex min-h-0 min-w-0 flex-col overflow-hidden ${className}`}
    >
      <div className="win-title relative z-10 flex items-center justify-between gap-1 border-b border-terminal-border bg-terminal-panel/80 px-1.5 py-0.5">
        <span className="win-jamb">◄</span>
        <span className="truncate font-mono text-[9px] leading-3 text-terminal-text-dim/90">
          {label}
        </span>
        <span className="win-jamb">►</span>
      </div>
      <div className={`relative z-10 min-h-0 min-w-0 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  )
}

/** Tall squashed label used for the cam IDs and switch rows. */
export function TallLabel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block origin-center text-terminal-accent ${className}`}
      style={{ transform: 'scale(1.5, 1.25)' }}
    >
      {children}
    </span>
  )
}
