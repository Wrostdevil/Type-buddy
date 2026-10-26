import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyKey,
  buildResult,
  consistency,
  createTestState,
  keyFeedback,
  liveStats,
  resultLabel,
  tick,
} from './engine'
import type { TestConfig, TestState } from './engine'

const wordsCfg: TestConfig = {
  mode: 'words',
  timeLimit: 30,
  wordCount: 5,
  punctuation: false,
  numbers: false,
}

const timeCfg: TestConfig = {
  mode: 'time',
  timeLimit: 15,
  wordCount: 25,
  punctuation: false,
  numbers: false,
}

/** Type a whole word character by character. */
function typeWord(state: TestState, word: string, cfg: TestConfig): TestState {
  let next = state
  for (const ch of word) next = applyKey(next, ch, cfg)
  return next
}

describe('createTestState', () => {
  it('creates an empty state with the requested words', () => {
    const state = createTestState(wordsCfg, ['a', 'b', 'c'])
    expect(state.words).toEqual(['a', 'b', 'c'])
    expect(state.typed).toEqual(['', '', ''])
    expect(state.index).toBe(0)
    expect(state.startedAt).toBeNull()
    expect(state.finished).toBe(false)
    expect(state.chars).toEqual({ correct: 0, incorrect: 0 })
  })

  it('generates the word count for words mode', () => {
    const state = createTestState(wordsCfg)
    expect(state.words).toHaveLength(5)
  })
})

describe('applyKey', () => {
  it('counts correct characters and starts the clock', () => {
    let state = createTestState(wordsCfg, ['hello', 'world', 'a', 'b', 'c'])
    expect(state.startedAt).toBeNull()
    state = typeWord(state, 'hello', wordsCfg)
    expect(state.chars.correct).toBe(5)
    expect(state.chars.incorrect).toBe(0)
    expect(state.index).toBe(0)
    expect(state.startedAt).not.toBeNull()
  })

  it('counts incorrect characters as errors', () => {
    let state = createTestState(wordsCfg, ['hello', 'world', 'a', 'b', 'c'])
    state = typeWord(state, 'hxllo', wordsCfg)
    expect(state.chars.correct).toBe(4)
    expect(state.chars.incorrect).toBe(1)
    expect(state.errorsTotal).toBe(1)
  })

  it('space commits a word and counts the separator when correct', () => {
    let state = createTestState(wordsCfg, ['hello', 'world', 'a', 'b', 'c'])
    state = typeWord(state, 'hello', wordsCfg)
    state = applyKey(state, ' ', wordsCfg)
    expect(state.index).toBe(1)
    expect(state.chars.correct).toBe(6)
    state = applyKey(state, ' ', wordsCfg)
    expect(state.index).toBe(1) // space at word start is ignored
    expect(state.chars.correct).toBe(6) // separator only counted when word correct
  })

  it('ignores space at the start of a word', () => {
    let state = createTestState(wordsCfg, ['hello', 'world', 'a', 'b', 'c'])
    state = applyKey(state, ' ', wordsCfg)
    expect(state.index).toBe(0)
    expect(state.chars).toEqual({ correct: 0, incorrect: 0 })
  })

  it('backspace removes characters', () => {
    let state = createTestState(wordsCfg, ['hello', 'world', 'a', 'b', 'c'])
    state = typeWord(state, 'hx', wordsCfg)
    state = applyKey(state, 'Backspace', wordsCfg)
    expect(state.typed[0]).toBe('h')
  })

  it('backspace steps back into the previous word when empty', () => {
    let state = createTestState(wordsCfg, ['hello', 'world', 'a', 'b', 'c'])
    state = typeWord(state, 'hello', wordsCfg)
    state = applyKey(state, ' ', wordsCfg)
    state = applyKey(state, 'w', wordsCfg)
    state = applyKey(state, 'Backspace', wordsCfg) // remove 'w'
    state = applyKey(state, 'Backspace', wordsCfg) // go back a word
    expect(state.index).toBe(0)
    expect(state.typed[0]).toBe('hello')
  })

  it('finishes in words mode after a space on the last word', () => {
    let state = createTestState(wordsCfg, ['a', 'b', 'c', 'd', 'e'])
    for (const word of ['a', 'b', 'c', 'd']) {
      state = typeWord(state, word, wordsCfg)
      state = applyKey(state, ' ', wordsCfg)
    }
    expect(state.finished).toBe(false)
    state = typeWord(state, 'e', wordsCfg)
    state = applyKey(state, ' ', wordsCfg)
    expect(state.finished).toBe(true)
    expect(state.finishedAt).not.toBeNull()
  })

  it('auto-finishes when the last word is typed fully correct', () => {
    let state = createTestState(wordsCfg, ['a', 'b', 'c', 'd', 'end'])
    for (const word of ['a', 'b', 'c', 'd']) {
      state = typeWord(state, word, wordsCfg)
      state = applyKey(state, ' ', wordsCfg)
    }
    state = typeWord(state, 'end', wordsCfg)
    expect(state.finished).toBe(true)
  })

  it('does not finish early in time mode', () => {
    let state = createTestState(timeCfg, ['a', 'b', 'c'])
    state = typeWord(state, 'a', timeCfg)
    state = applyKey(state, ' ', timeCfg)
    expect(state.finished).toBe(false)
    expect(state.words.length).toBeGreaterThan(3) // buffer extended
  })

  it('ignores keystrokes after finishing', () => {
    let state = createTestState(wordsCfg, ['a'])
    state = typeWord(state, 'a', wordsCfg)
    expect(state.finished).toBe(true)
    const after = applyKey(state, 'x', wordsCfg)
    expect(after).toBe(state)
  })

  it('ignores multi-character keys like Shift', () => {
    const state = createTestState(wordsCfg, ['hello', 'world', 'a', 'b', 'c'])
    const after = applyKey(state, 'Shift', wordsCfg)
    expect(after.chars).toEqual({ correct: 0, incorrect: 0 })
  })
})

describe('keyFeedback', () => {
  it('classifies correct and incorrect characters', () => {
    const state = createTestState(wordsCfg, ['hello', 'world', 'a', 'b', 'c'])
    expect(keyFeedback(state, 'h')).toEqual({ kind: 'char', correct: true })
    expect(keyFeedback(state, 'x')).toEqual({ kind: 'char', correct: false })
  })

  it('mirrors applyKey ignore rules', () => {
    let state = createTestState(wordsCfg, ['hello', 'world', 'a', 'b', 'c'])
    expect(keyFeedback(state, ' ')).toEqual({ kind: 'none', correct: true }) // space at word start
    expect(keyFeedback(state, 'Shift')).toEqual({ kind: 'none', correct: true })
    expect(keyFeedback(state, 'Backspace')).toEqual({ kind: 'none', correct: true }) // nothing to delete
    state = typeWord(state, 'hello', wordsCfg)
    expect(keyFeedback(state, ' ')).toEqual({ kind: 'space', correct: true })
    state = applyKey(state, ' ', wordsCfg)
    expect(keyFeedback(state, 'Backspace')).toEqual({
      kind: 'backspace',
      correct: true,
    }) // steps back into the previous word
  })

  it('stays silent for wrong words, capped extras and finished tests', () => {
    let state = createTestState(wordsCfg, ['hello', 'world', 'a', 'b', 'c'])
    state = typeWord(state, 'hx', wordsCfg)
    expect(keyFeedback(state, ' ')).toEqual({ kind: 'space', correct: false })
    // extra characters beyond applyKey's cap are ignored → no sound
    const capped = { ...state, typed: ['hx' + '.'.repeat(11)] } // 13 = target 5 + 8
    expect(keyFeedback(capped, 'x')).toEqual({ kind: 'none', correct: true })
    // finished tests stay silent
    state = createTestState(wordsCfg, ['a', 'b', 'c', 'd', 'e'])
    for (const word of ['a', 'b', 'c', 'd']) {
      state = typeWord(state, word, wordsCfg)
      state = applyKey(state, ' ', wordsCfg)
    }
    state = typeWord(state, 'e', wordsCfg)
    expect(state.finished).toBe(true)
    expect(keyFeedback(state, ' ')).toEqual({ kind: 'none', correct: true })
  })
})

describe('tick', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does nothing before the test starts', () => {
    const state = createTestState(timeCfg)
    expect(tick(state, timeCfg)).toBe(state)
  })

  it('pushes one sample per elapsed second', () => {
    const start = Date.now()
    let state: TestState = {
      ...createTestState(timeCfg, ['a', 'b', 'c']),
      startedAt: start,
      chars: { correct: 25, incorrect: 5 },
    }
    vi.setSystemTime(start + 2500)
    state = tick(state, timeCfg)
    expect(state.samples).toHaveLength(2)
    expect(state.samples[0].t).toBe(1)
    expect(state.samples[1].t).toBe(2)
    // sample 1: 30 chars typed within that second
    expect(state.samples[0].raw).toBe((30 / 5) * 60)
    expect(state.samples[1].raw).toBe(0)
  })

  it('finishes a time-limited test', () => {
    const start = Date.now()
    const state: TestState = {
      ...createTestState(timeCfg),
      startedAt: start,
    }
    vi.setSystemTime(start + 16000)
    const next = tick(state, timeCfg)
    expect(next.finished).toBe(true)
    expect(next.finishedAt).not.toBeNull()
  })

  it('extends the word buffer in time mode', () => {
    const start = Date.now()
    const state: TestState = {
      ...createTestState(timeCfg, Array.from({ length: 90 }, (_, i) => `w${i}`)),
      startedAt: start,
      index: 80,
    }
    const next = tick(state, timeCfg)
    expect(next.words.length).toBeGreaterThan(90)
  })
})

describe('liveStats', () => {
  it('returns zeros before starting', () => {
    const state = createTestState(timeCfg)
    const stats = liveStats(state)
    expect(stats.wpm).toBe(0)
    expect(stats.acc).toBe(100)
    expect(stats.elapsed).toBe(0)
  })

  it('freezes stats after finish', () => {
    const state: TestState = {
      ...createTestState(timeCfg),
      startedAt: 0,
      finishedAt: 60000,
      finished: true,
      chars: { correct: 100, incorrect: 0 },
    }
    const stats = liveStats(state)
    expect(stats.elapsed).toBe(60)
    expect(stats.wpm).toBe(20)
    expect(stats.acc).toBe(100)
  })
})

describe('buildResult', () => {
  it('computes wpm, raw, accuracy and missed characters', () => {
    const state: TestState = {
      ...createTestState(wordsCfg, ['hello', 'world', 'x']),
      startedAt: 0,
      finishedAt: 60000,
      finished: true,
      typed: ['hello', 'wo', ''],
      index: 1,
      chars: { correct: 100, incorrect: 25 },
    }
    const result = buildResult(state, wordsCfg)
    expect(result.wpm).toBe(20) // 100 chars / 5 / 1 min
    expect(result.raw).toBe(25) // 125 chars / 5 / 1 min
    expect(result.accuracy).toBe(80)
    expect(result.modeValue).toBe(5)
    // missed: current word remainder (3) + untyped words ("x" + 1 space) = 5
    expect(result.chars.missed).toBe(5)
  })

  it('labels results correctly', () => {
    const state = createTestState(timeCfg)
    const result = buildResult(state, timeCfg)
    expect(resultLabel(result)).toBe('15s')
  })
})

describe('consistency', () => {
  it('is 0 without samples', () => {
    expect(consistency([])).toBe(0)
  })

  it('is 100 for a single sample', () => {
    expect(consistency([{ t: 1, wpm: 0, raw: 60, errors: 0 }])).toBe(100)
  })

  it('is 100 for perfectly even pacing', () => {
    const samples = [60, 60, 60].map((raw, i) => ({ t: i + 1, wpm: 0, raw, errors: 0 }))
    expect(consistency(samples)).toBe(100)
  })

  it('decreases with uneven pacing', () => {
    const samples = [30, 120, 40, 110].map((raw, i) => ({
      t: i + 1,
      wpm: 0,
      raw,
      errors: 0,
    }))
    const value = consistency(samples)
    expect(value).toBeGreaterThan(0)
    expect(value).toBeLessThan(100)
  })
})
