import { describe, expect, it } from 'vitest'
import { COMMON_WORDS, generateWords } from './words'

/** Small deterministic LCG so tests are reproducible. */
function lcg(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('generateWords', () => {
  it('returns the requested number of words', () => {
    const words = generateWords({ punctuation: false, numbers: false }, 42, lcg(1))
    expect(words).toHaveLength(42)
  })

  it('only emits list words when modifiers are off', () => {
    const words = generateWords({ punctuation: false, numbers: false }, 100, lcg(7))
    for (const word of words) {
      expect(COMMON_WORDS).toContain(word)
    }
  })

  it('decorates words with punctuation when enabled', () => {
    const words = generateWords({ punctuation: true, numbers: false }, 300, lcg(3))
    const decorated = words.filter(
      (w) => /^[A-Z]/.test(w) || /[.,!?;:]$/.test(w),
    )
    expect(decorated.length).toBeGreaterThan(0)
  })

  it('emits numbers when enabled', () => {
    const words = generateWords({ punctuation: false, numbers: true }, 500, lcg(11))
    expect(words.some((w) => /^\d+$/.test(w))).toBe(true)
  })

  it('is deterministic for a given rng', () => {
    const a = generateWords({ punctuation: true, numbers: true }, 50, lcg(99))
    const b = generateWords({ punctuation: true, numbers: true }, 50, lcg(99))
    expect(a).toEqual(b)
  })
})
