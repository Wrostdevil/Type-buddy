/**
 * Tiny localStorage-backed hall of fame for lesson progress and arcade
 * high scores. Values are plain numbers keyed by strings like
 * `lesson:home-row:wpm` / `game:invaders`.
 */

const KEY = 'ghost-terminal:bests'

export type Bests = Record<string, number>

export function loadBests(): Bests {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Bests) : {}
  } catch {
    return {}
  }
}

export function saveBest(key: string, value: number): void {
  try {
    const bests = loadBests()
    if (bests[key] === value) return
    bests[key] = value
    localStorage.setItem(KEY, JSON.stringify(bests))
  } catch {
    // storage unavailable — scores just won't persist
  }
}

/** Convenience predicates for "higher is better" vs "lower is better". */
export function bestIfHigher(key: string, value: number): number {
  return Math.max(loadBests()[key] ?? 0, value)
}

export function bestIfLower(key: string, value: number): number {
  const cur = loadBests()[key]
  if (cur === undefined) return value
  return Math.min(cur, value)
}
