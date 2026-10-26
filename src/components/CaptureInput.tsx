import { forwardRef, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import { diffKeys, dispatchVirtualKey } from '../lib/virtualKey'

export interface CaptureInputProps {
  /** 'engine' → onKey() feeds the breach engine; 'window' → synthetic keydowns */
  mode: 'engine' | 'window'
  /** engine-mode keystroke sink (chars, ' ', 'Backspace') */
  onKey?: (key: string) => void
}

/**
 * The phone keypad port. Hardware keyboards speak clean `window` keydowns,
 * but on-screen keypads report 229/`Unidentified` junk (Android composition)
 * and iOS zooms the viewport on sub-16px inputs. So the keypad edits this
 * invisible 16px input, and the value's live diff becomes the keystroke
 * stream — insertions, deletions, even word-rewrite autocorrect.
 *
 * The value is never reset: diffs are incremental, so restarts can't echo
 * stale text into the engine. A capture-phase interceptor swallows the
 * (garbage or duplicating) raw keydowns before app/game listeners see them —
 * Tab / Escape / Enter pass through for the shortcut handlers.
 */
export const CaptureInput = forwardRef<HTMLInputElement, CaptureInputProps>(
  function CaptureInput({ mode, onKey }, forwardedRef) {
    const inputRef = useRef<HTMLInputElement | null>(null)
    // last input value we already turned into keystrokes
    const mirror = useRef('')

    // merge into the caller's ref so taps can focus the ported input
    useEffect(() => {
      if (typeof forwardedRef === 'function') forwardedRef(inputRef.current)
      else if (forwardedRef) forwardedRef.current = inputRef.current
    })

    useEffect(() => {
      const swallow = (e: KeyboardEvent) => {
        if (e.target !== inputRef.current) return
        if (e.key === 'Tab' || e.key === 'Escape' || e.key === 'Enter') return
        e.stopPropagation()
      }
      window.addEventListener('keydown', swallow, true)
      return () => window.removeEventListener('keydown', swallow, true)
    }, [])

    const handleInput = (e: FormEvent<HTMLInputElement>) => {
      const el = e.currentTarget
      const next = el.value
      const keys = diffKeys(mirror.current, next)
      if (keys.length === 0) return
      mirror.current = next

      if (mode === 'window') {
        for (const key of keys) dispatchVirtualKey(key)
      } else {
        for (const key of keys) onKey?.(key)
      }
    }

    return (
      <input
        ref={inputRef}
        aria-hidden="true"
        tabIndex={-1}
        inputMode="text"
        enterKeyHint="done"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        onInput={handleInput}
        className="pointer-events-none absolute left-1 top-1 m-0 h-px w-px min-w-0 border-0 bg-transparent p-0 font-mono text-[16px] leading-none text-transparent caret-transparent opacity-0 outline-none select-none"
      />
    )
  },
)
