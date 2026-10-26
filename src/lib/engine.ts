import { generateWords } from './words'
import { generateLessonWords } from './lessons'
import type { LessonId } from './lessons'

export type Mode = 'time' | 'words'

export interface TestConfig {
  mode: Mode
  /** seconds, used when mode === 'time' */
  timeLimit: number
  /** word count, used when mode === 'words' */
  wordCount: number
  punctuation: boolean
  numbers: boolean
  /** active training lesson; null = free test */
  lesson?: LessonId | null
}

export interface Sample {
  /** seconds since start */
  t: number
  wpm: number
  raw: number
  errors: number
}

export interface TestState {
  words: string[]
  /** typed string per word index */
  typed: string[]
  /** index of the word currently being typed */
  index: number
  startedAt: number | null
  finishedAt: number | null
  finished: boolean
  /** keystroke characters (spaces included when correct) */
  chars: { correct: number; incorrect: number }
  errorsTotal: number
  samples: Sample[]
  lastSampleChars: number
  lastSampleErrors: number
}

export interface TestResult {
  id?: number
  mode: Mode
  modeValue: number
  punctuation: boolean
  numbers: boolean
  wpm: number
  raw: number
  accuracy: number
  consistency: number
  chars: { correct: number; incorrect: number; missed: number }
  series: Sample[]
  date: number
}

/** how many extra (wrong) characters may be typed past a word's length */
const MAX_EXTRA_CHARS = 8
/** initial word buffer for time mode */
const TIME_BUFFER_WORDS = 90
const EXTEND_AMOUNT = 40

/**
 * Word source: lessons override the random generator entirely —
 * their drills ARE the payload.
 */
export function sourceWords(config: TestConfig, count: number): string[] {
  if (config.lesson) return generateLessonWords(config.lesson, count)
  return generateWords(
    config,
    count,
  )
}

export function createTestState(config: TestConfig, words?: string[]): TestState {
  const generated =
    words ??
    sourceWords(
      config,
      config.mode === 'time' ? TIME_BUFFER_WORDS : config.wordCount,
    )
  return {
    words: generated,
    typed: generated.map(() => ''),
    index: 0,
    startedAt: null,
    finishedAt: null,
    finished: false,
    chars: { correct: 0, incorrect: 0 },
    errorsTotal: 0,
    samples: [],
    lastSampleChars: 0,
    lastSampleErrors: 0,
  }
}

function increment(
  chars: TestState['chars'],
  correct: boolean,
): TestState['chars'] {
  return correct
    ? { correct: chars.correct + 1, incorrect: chars.incorrect }
    : { correct: chars.correct, incorrect: chars.incorrect + 1 }
}

/**
 * Applies a single keystroke to the test state and returns a new state.
 * Supported keys: printable characters, ' ' (commit word), 'Backspace'.
 */
export function applyKey(state: TestState, key: string, config: TestConfig): TestState {
  if (state.finished) return state
  const startedAt = state.startedAt ?? Date.now()
  const base: TestState = { ...state, startedAt }

  if (key === 'Backspace') {
    const current = state.typed[state.index] ?? ''
    if (current.length > 0) {
      const typed = state.typed.slice()
      typed[state.index] = current.slice(0, -1)
      return { ...base, typed }
    }
    // at word start: step back into the previous word to fix it
    if (state.index > 0) {
      return { ...base, index: state.index - 1 }
    }
    return base
  }

  if (key === ' ') {
    const current = state.typed[state.index] ?? ''
    if (current.length === 0) return base // ignore space at word start
    const wordCorrect = current === state.words[state.index]
    const chars = increment(state.chars, wordCorrect)
    const index = state.index + 1
    let words = state.words
    if (config.mode === 'time' && index > words.length - 20) {
      words = words.concat(sourceWords(config, EXTEND_AMOUNT))
    }
    const finished = config.mode === 'words' && index >= state.words.length
    // sample first (while still "running"), then mark finished
    const next = pushSamples({ ...base, words, typed: state.typed.slice(), chars, index })
    return { ...next, finished, finishedAt: finished ? Date.now() : null }
  }

  if (key.length === 1) {
    const current = state.typed[state.index] ?? ''
    const target = state.words[state.index] ?? ''
    if (current.length >= target.length + MAX_EXTRA_CHARS) return base
    const correct = key === target[current.length]
    const chars = increment(state.chars, correct)
    const errorsTotal = state.errorsTotal + (correct ? 0 : 1)
    const typed = state.typed.slice()
    typed[state.index] = current + key
    const finished =
      config.mode === 'words' &&
      state.index === state.words.length - 1 &&
      current + key === target
    const next = pushSamples({ ...base, typed, chars, errorsTotal })
    return { ...next, finished, finishedAt: finished ? Date.now() : null }
  }

  return base
}

export interface KeyFeedback {
  /** which mechanical sound (if any) the keystroke maps to */
  kind: 'char' | 'space' | 'backspace' | 'none'
  /** whether the keystroke landed on the expected character */
  correct: boolean
}

const NO_FEEDBACK: KeyFeedback = { kind: 'none', correct: true }

/**
 * Classifies a keystroke for audio feedback without mutating state.
 * Mirrors applyKey's ignore rules so muted-by-the-engine keys stay silent.
 */
export function keyFeedback(state: TestState, key: string): KeyFeedback {
  if (state.finished) return NO_FEEDBACK

  if (key === 'Backspace') {
    const deletable =
      (state.typed[state.index]?.length ?? 0) > 0 || state.index > 0
    return deletable ? { kind: 'backspace', correct: true } : NO_FEEDBACK
  }

  if (key === ' ') {
    const current = state.typed[state.index] ?? ''
    if (current.length === 0) return NO_FEEDBACK // space at word start is ignored
    return { kind: 'space', correct: current === state.words[state.index] }
  }

  if (key.length === 1) {
    const current = state.typed[state.index] ?? ''
    const target = state.words[state.index] ?? ''
    if (current.length >= target.length + MAX_EXTRA_CHARS) return NO_FEEDBACK // capped
    return { kind: 'char', correct: key === target[current.length] }
  }

  return NO_FEEDBACK
}

/** Pushes one sample per elapsed whole second, based on wall-clock time. */
export function pushSamples(state: TestState): TestState {
  if (!state.startedAt || state.finished) return state
  const elapsedSec = Math.floor((Date.now() - state.startedAt) / 1000)
  if (elapsedSec <= state.samples.length) return state

  let next = state
  while (next.samples.length < elapsedSec) {
    const t = next.samples.length + 1
    const minutes = t / 60
    const charsTotal = next.chars.correct + next.chars.incorrect
    const deltaChars = charsTotal - next.lastSampleChars
    const deltaErrors = next.chars.incorrect - next.lastSampleErrors
    const sample: Sample = {
      t,
      wpm: Math.round(((next.chars.correct / 5) / minutes) * 100) / 100,
      raw: Math.max(0, Math.round((deltaChars / 5) * 60)),
      errors: deltaErrors,
    }
    next = {
      ...next,
      samples: [...next.samples, sample],
      lastSampleChars: charsTotal,
      lastSampleErrors: next.chars.incorrect,
    }
  }
  return next
}

/**
 * Drives the test forward: pushes time-based samples, extends the word
 * buffer in time mode and finishes time-limited tests. Call from an interval.
 */
export function tick(state: TestState, config: TestConfig): TestState {
  if (!state.startedAt || state.finished) return state
  const elapsedMs = Date.now() - state.startedAt
  if (config.mode === 'time' && elapsedMs >= config.timeLimit * 1000) {
    return { ...pushSamples(state), finished: true, finishedAt: Date.now() }
  }
  // safety net: keep the word buffer topped up in time mode
  let next = state
  if (config.mode === 'time' && next.index > next.words.length - 20) {
    next = { ...next, words: next.words.concat(sourceWords(config, EXTEND_AMOUNT)) }
  }
  return pushSamples(next)
}

/** Frozen live statistics (safe to render at any time). */
export function liveStats(state: TestState): {
  elapsed: number
  wpm: number
  acc: number
} {
  const end = state.finishedAt ?? Date.now()
  const elapsedMs = state.startedAt !== null ? Math.max(0, end - state.startedAt) : 0
  const minutes = elapsedMs / 60000
  const total = state.chars.correct + state.chars.incorrect
  return {
    elapsed: elapsedMs / 1000,
    wpm: minutes > 0 ? state.chars.correct / 5 / minutes : 0,
    acc: total > 0 ? (state.chars.correct / total) * 100 : 100,
  }
}

/**
 * Typing consistency: penalises variation of raw speed across the samples.
 * 100 means perfectly even pace.
 */
export function consistency(samples: Sample[]): number {
  const raws = samples.map((s) => s.raw).filter((r) => r > 0)
  if (raws.length === 0) return 0
  if (raws.length === 1) return 100
  const mean = raws.reduce((a, b) => a + b, 0) / raws.length
  if (mean === 0) return 0
  const variance =
    raws.reduce((acc, r) => acc + (r - mean) ** 2, 0) / raws.length
  const cv = Math.sqrt(variance) / mean
  return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Builds the final immutable result of a finished test. */
export function buildResult(state: TestState, config: TestConfig): TestResult {
  const startedAt = state.startedAt
  const end = state.finishedAt ?? (startedAt !== null ? Date.now() : 0)
  const minutes =
    startedAt !== null ? Math.max((end - startedAt) / 60000, 250 / 60000) : 0
  const total = state.chars.correct + state.chars.incorrect

  let missed = 0
  if (config.mode === 'words') {
    // words after the current one: each full word + its separator space
    for (let i = state.index + 1; i < state.words.length; i++) {
      missed += state.words[i].length + 1
    }
    // current word: only the part that was not typed correctly
    const currentTyped = state.typed[state.index]?.length ?? 0
    if (state.index < state.words.length) {
      missed += Math.max(0, state.words[state.index].length - currentTyped)
    }
  }

  return {
    mode: config.mode,
    modeValue: config.mode === 'time' ? config.timeLimit : config.wordCount,
    punctuation: config.punctuation,
    numbers: config.numbers,
    wpm: round2(minutes > 0 ? state.chars.correct / 5 / minutes : 0),
    raw: round2(minutes > 0 ? total / 5 / minutes : 0),
    accuracy: total > 0 ? Math.round((state.chars.correct / total) * 1000) / 10 : 100,
    consistency: consistency(state.samples),
    chars: { correct: state.chars.correct, incorrect: state.chars.incorrect, missed },
    series: state.samples,
    date: end,
  }
}

/** Human readable test type, e.g. "30s" or "25 words @ #". */
export function resultLabel(
  result: Pick<TestResult, 'mode' | 'modeValue' | 'punctuation' | 'numbers'>,
): string {
  const base = result.mode === 'time' ? `${result.modeValue}s` : `${result.modeValue} words`
  return base + (result.punctuation ? ' @' : '') + (result.numbers ? ' #' : '')
}

