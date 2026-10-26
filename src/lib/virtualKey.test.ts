import { describe, expect, it } from 'vitest'
import { diffKeys, isVirtualKey, VIRTUAL_KEY_FLAG } from './virtualKey'
import { applyKey, createTestState } from './engine'
import type { TestConfig } from './engine'

const config: TestConfig = {
  mode: 'words',
  timeLimit: 30,
  wordCount: 25,
  punctuation: false,
  numbers: false,
  lesson: null,
}

describe('diffKeys — keypad-port value diff', () => {
  it('is silent for unchanged values', () => {
    expect(diffKeys('abc', 'abc')).toEqual([])
  })

  it('maps pure appends to typed chars', () => {
    expect(diffKeys('', 'hello')).toEqual(['h', 'e', 'l', 'l', 'o'])
    expect(diffKeys('hel', 'hello')).toEqual(['l', 'o'])
  })

  it('maps pure deletions to backspaces', () => {
    expect(diffKeys('hello', 'hell')).toEqual(['Backspace'])
    expect(diffKeys('hello', '')).toEqual([
      'Backspace',
      'Backspace',
      'Backspace',
      'Backspace',
      'Backspace',
    ])
  })

  it('maps word rewrites (keypad autocorrect) to replace-keystrokes', () => {
    // user typed "teh"; the keypad commits the corrected "the"
    expect(diffKeys('teh', 'the')).toEqual(['Backspace', 'Backspace', 'h', 'e'])
    // whole-word replacement: "one" → "no"
    expect(diffKeys('one', 'no')).toEqual([
      'Backspace',
      'Backspace',
      'Backspace',
      'n',
      'o',
    ])
  })

  it('keeps a shared prefix when both inserting and deleting', () => {
    expect(diffKeys('ab', 'abc')).toEqual(['c'])
    expect(diffKeys('abc', 'abx')).toEqual(['Backspace', 'x'])
  })
})

describe('diffKeys round-trip through the typing engine', () => {
  /**
   * Simulates the phone keypad port: the transcript grows as the user
   * types and a backspace re-enters the last value minus one char.
   */

  it('types a word, commits with space, then backspaces a wrong char', () => {
    let state = createTestState(config)
    let mirror = ''
    const sent: string[] = []
    const burst = (value: string) => {
      const keys = diffKeys(mirror, value)
      sent.push(...keys)
      for (const key of keys) state = applyKey(state, key, config)
      mirror = value
    }

    burst('ghost') // 5 chars land on word #0
    expect(state.startedAt).not.toBeNull()
    expect(state.typed[0]).toBe('ghost')

    burst('ghost ') // space commits the word — space is not stored
    expect(state.index).toBe(1)

    burst('ghost x') // a wrong char lands on word #1
    expect(state.typed[1]).toBe('x')

    burst('ghost ') // keypad backspace deletes it
    expect(sent[sent.length - 1]).toBe('Backspace')
    expect(state.typed[1]).toBe('')

    // the transcript stream is exactly a real keypad's stream
    expect(sent.join('|')).toBe('g|h|o|s|t| |x|Backspace')
  })

  it('a backspace at word start slides back into the previous word', () => {
    let state = createTestState(config)
    let mirror = ''
    const step = (value: string) => {
      for (const key of diffKeys(mirror, value)) state = applyKey(state, key, config)
      mirror = value
    }

    // commit "ghost" then correct through the committed space
    step('ghost')
    step('ghost ')
    step('ghost x')
    step('ghost ') // delete the wrong char on word #1
    step('ghost') // backspace on an empty buffer slides into word #0
    step('ghos') // and keeps trimming it

    expect(state.index).toBe(0)
    expect(state.typed[0]).toBe('ghos')
  })

  it('restarts cleanly while the transcript keeps growing', () => {
    const config30: TestConfig = { ...config, mode: 'time', timeLimit: 30 }
    let state = createTestState(config30)
    let mirror = ''
    const burst = (value: string) => {
      for (const key of diffKeys(mirror, value)) state = applyKey(state, key, config30)
      mirror = value
    }

    burst('ghost ')
    expect(state.index).toBe(1)

    // operator restarts the test; the port value is untouched
    state = createTestState(config30)
    expect(state.index).toBe(0)

    // next keypad burst diffs against the intact transcript — only the
    // new chars reach the engine, stale text is not replayed
    burst('ghost hunt')
    expect(state.typed[0]).toBe('hunt')
  })
})

describe('isVirtualKey', () => {
  it('flags virtual events and ignores plain events', () => {
    const virtual = { [VIRTUAL_KEY_FLAG]: true } as unknown as KeyboardEvent
    expect(isVirtualKey(virtual)).toBe(true)
    expect(isVirtualKey({} as KeyboardEvent)).toBe(false)
  })
})
