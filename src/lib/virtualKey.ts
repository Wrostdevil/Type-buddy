/** flag baked onto the synthetic key events we dispatch for virtual keypads */
export const VIRTUAL_KEY_FLAG = '__ghostVirtual'

type KeyboardEventWithFlag = KeyboardEvent & { [VIRTUAL_KEY_FLAG]?: true }

/** true for synthesized keypad events — app/game listeners must skip these */
export function isVirtualKey(e: KeyboardEvent): boolean {
  return Boolean((e as KeyboardEventWithFlag)[VIRTUAL_KEY_FLAG])
}

/**
 * Feed one keypad keystroke into window listeners as a real-looking keydown.
 * Arcade cabinets listen on `window` and need zero changes to play on a phone.
 */
export function dispatchVirtualKey(key: string): void {
  const event = new KeyboardEvent('keydown', {
    key,
    cancelable: true,
  })
  Object.defineProperty(event, VIRTUAL_KEY_FLAG, { value: true })
  window.dispatchEvent(event)
}

/**
 * Diff two snapshots of the keypad-port value into a keystroke list:
 * common prefix first, then one `Backspace` per removed char, then the
 * inserted chars in order. Covers append, delete and mid-word rewrites
 * (keypad autocorrect): `teh` → `the` becomes B, B, h, e.
 */
export function diffKeys(prev: string, next: string): string[] {
  if (prev === next) return []

  let shared = 0
  const max = Math.min(prev.length, next.length)
  while (shared < max && prev[shared] === next[shared]) shared++

  const keys: string[] = []
  for (let d = prev.length; d > shared; d--) keys.push('Backspace')
  for (const ch of next.slice(shared)) keys.push(ch)
  return keys
}
