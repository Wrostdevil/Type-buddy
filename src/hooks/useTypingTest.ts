import { useCallback, useEffect, useState } from 'react'
import {
  applyKey,
  createTestState,
  tick,
} from '../lib/engine'
import type { TestConfig, TestState } from '../lib/engine'

/**
 * Owns the typing test state machine: starts the clock on the first
 * keystroke, ticks the timer/sampler while running and restarts on demand.
 */
export function useTypingTest(config: TestConfig) {
  const [state, setState] = useState<TestState>(() => createTestState(config))

  // a config change (mode, duration, modifiers) starts a fresh test —
  // reset synchronously during render (React's derived-state pattern)
  const [prevConfig, setPrevConfig] = useState(config)
  if (prevConfig !== config) {
    setPrevConfig(config)
    setState(createTestState(config))
  }

  // timer + per-second sampling while the test runs
  useEffect(() => {
    if (!state.startedAt || state.finished) return
    const interval = window.setInterval(() => {
      setState((s) => tick(s, config))
    }, 100)
    return () => window.clearInterval(interval)
  }, [state.startedAt, state.finished, config])

  const press = useCallback(
    (key: string) => {
      setState((s) => applyKey(s, key, config))
    },
    [config],
  )

  const restart = useCallback(() => {
    setState(createTestState(config))
  }, [config])

  const repeat = useCallback(() => {
    // same target words, fresh run
    setState((s) => createTestState(config, s.words))
  }, [config])

  return { state, press, restart, repeat }
}
