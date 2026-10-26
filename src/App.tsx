import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HistoryView } from './components/History'
import { LessonsView } from './components/Lessons'
import { Arcade } from './components/Arcade'
import { CaptureInput } from './components/CaptureInput'
import { ModeBar } from './components/ModeBar'
import { Results } from './components/Results'
import { SystemHud } from './components/SystemHud'
import { TypeTest } from './components/TypeTest'
import { useTypingTest } from './hooks/useTypingTest'
import { isTouchOnly } from './lib/device'
import { isVirtualKey } from './lib/virtualKey'
import { AtomWidget } from './components/dashboard/AtomWidget'
import { BinaryStrip } from './components/dashboard/BinaryStrip'
import { BinaryWall } from './components/dashboard/BinaryWall'
import { CctvFeed } from './components/dashboard/CctvFeed'
import { CircuitBoard } from './components/dashboard/CircuitBoard'
import { DialGauge } from './components/dashboard/DialGauge'
import { KeyOsc } from './components/dashboard/KeyOsc'
import { Ledger } from './components/dashboard/Ledger'
import { SwitchPanel } from './components/dashboard/SwitchPanel'
import { TickerWindow } from './components/dashboard/TickerWindow'
import { VisNine, V9Badge } from './components/dashboard/Switch'
import { Win, TallLabel } from './components/dashboard/Win'
import { SysBar } from './components/dashboard/SysBar'
import type { View } from './components/dashboard/SysBar'
import { WorldMapWindow } from './components/dashboard/WorldMapWindow'
import { buildResult, keyFeedback, liveStats } from './lib/engine'
import type { TestConfig, TestResult } from './lib/engine'
import { lessonById, chapterOfLesson } from './lib/lessons'
import { bestIfHigher, saveBest } from './lib/bests'
import {
  clearResults,
  loadResults,
  saveResult,
  loadSettings,
  saveSettings,
  loadSoundSetting,
  saveSoundSetting,
} from './lib/storage'
import { playKeySound, setSoundEnabled } from './lib/sound'

const DEFAULT_SETTINGS: TestConfig = {
  mode: 'time',
  timeLimit: 30,
  wordCount: 25,
  punctuation: false,
  numbers: false,
  lesson: null,
}

const CAMS = ['7707-01', '7707-02', '7707-03', '7707-04', '7707-05']
const PCBS = ['BUS-α', 'BUS-β', 'CORE-δ', 'RELAY-γ', 'SAT-θ']

export default function App() {
  const [settings, setSettings] = useState<TestConfig>(
    () => loadSettings() ?? DEFAULT_SETTINGS,
  )
  const [view, setView] = useState<View>('breach')
  const [focused, setFocused] = useState(true)
  const [history, setHistory] = useState<TestResult[]>([])
  const [sound, setSound] = useState(() => loadSoundSetting())
  const [inputBlink, setInputBlink] = useState(false)
  const { state, press, restart, repeat } = useTypingTest(settings)
  // no precise pointer → the invisible keypad port below is how typing works
  const coarse = useMemo(() => isTouchOnly(), [])

  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])

  const captureRef = useRef<HTMLInputElement | null>(null)

  // raise the on-screen keypad (touch flows) — stays scrolled with the console
  const focusKeypad = useCallback(() => {
    captureRef.current?.focus({ preventScroll: true })
  }, [])

  // slow ambient heartbeat: keeps dials, tapes and jitter alive when idle
  const [heartbeat, setHeartbeat] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setHeartbeat((t) => t + 1), 240)
    return () => window.clearInterval(id)
  }, [])

  const live = liveStats(state)
  const running = state.startedAt !== null && !state.finished
  const lesson = lessonById(settings.lesson ?? null)
  const lessonChapter = chapterOfLesson(settings.lesson ?? null)
  const energy = running ? Math.min(12, Math.round(live.wpm * 0.2)) : 0
  const dialWpm = running ? Math.min(160, live.wpm) : state.finished ? Math.min(160, live.wpm) : 2
  // deterministic pseudo-jitter derived from the heartbeat tick (pure render)
  const jitter = running
    ? Math.abs(Math.sin(heartbeat * 0.7)) * 10
    : Math.abs(Math.sin(heartbeat * 0.3)) * 3.6
  const traceLevel = Math.min(99, state.errorsTotal * 9 + jitter)
  const progress =
    settings.mode === 'time'
      ? Math.min(100, (live.elapsed / settings.timeLimit) * 100)
      : Math.min(100, (state.index / Math.max(1, state.words.length || settings.wordCount)) * 100)

  // mirror the sound preference into the audio engine and persist it
  useEffect(() => {
    setSoundEnabled(sound)
    saveSoundSetting(sound)
  }, [sound])

  // save each finished test exactly once
  const savedStampRef = useRef<number | null>(null)
  useEffect(() => {
    if (!state.finished || !state.startedAt) return
    const stamp = state.finishedAt ?? Date.now()
    if (savedStampRef.current === stamp) return
    savedStampRef.current = stamp
    const result = buildResult(state, settings)
    // lessons persist their clearing telemetry (best wpm / best acc)
    if (settings.lesson) {
      saveBest(`lesson:${settings.lesson}:wpm`, bestIfHigher(`lesson:${settings.lesson}:wpm`, Math.round(result.wpm)))
      saveBest(`lesson:${settings.lesson}:acc`, bestIfHigher(`lesson:${settings.lesson}:acc`, result.accuracy))
    }
    saveResult(result)
      .then((saved) => setHistory((h) => [saved, ...h]))
      .catch((error) => console.error('failed to save result', error))
  }, [state, settings])

  // load persisted history once
  useEffect(() => {
    loadResults().then(setHistory).catch(() => {})
  }, [])

  // persist settings whenever they change
  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  // track window focus so typing pauses when the tab loses focus
  useEffect(() => {
    const onFocus = () => setFocused(true)
    const onBlur = () => setFocused(false)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  // buttons must never keep keyboard focus, otherwise space/enter would
  // re-trigger them instead of reaching the typing test
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const button = (e.target as HTMLElement | null)?.closest('button')
      if (button) button.blur()
      // touch devices: keep the on-screen keypad raised across console
      // taps (restart / next test / mode buttons), except on nav chrome
      if (
        coarse &&
        viewRef.current === 'breach' &&
        !button?.closest('header')
      ) {
        captureRef.current?.focus({ preventScroll: true })
      }
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [coarse])

  // phone keypad → breach engine. the CaptureInput diff feeds one key at
  // a time; state is a snapshot so multi-key bursts grade on stale typed
  // data for sound only — the engine itself is fed sequentially and stays exact.
  const handleVirtualKey = useCallback(
    (key: string) => {
      if (view !== 'breach' || state.finished) return
      if (!focused && state.startedAt !== null) return
      const feedback = keyFeedback(state, key)
      press(key)
      playKeySound(feedback)
    },
    [view, state, focused, press],
  )

  // global keyboard handling — non-breach views leave keys to their owner
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // synthesized keypad events already went through the engine / games
      if (isVirtualKey(e)) return

      if (view !== 'breach') {
        // running games own Escape while they capture the keyboard
        if (e.key === 'Escape' && !document.body.dataset.gameCapture) setView('breach')
        // keep the page from scrolling or chasing focus during drills
        if (e.key === 'Tab' || e.key === ' ') e.preventDefault()
        return
      }

      if (e.key === 'Tab' || e.key === 'Escape') {
        e.preventDefault()
        restart()
        return
      }

      if (state.finished) {
        if (e.key === 'Enter') restart()
        return
      }

      // don't capture keystrokes while the window is unfocused mid-test
      if (!focused && state.startedAt !== null) return

      // classify the keystroke before applying it so the typewriter sound
      // mirrors exactly what the engine is about to accept/ignore
      const feedback = keyFeedback(state, e.key)

      if (e.key === ' ') e.preventDefault()
      if (e.key === 'Backspace') {
        e.preventDefault()
        press('Backspace')
      } else if (e.key.length === 1) {
        press(e.key)
      }
      playKeySound(feedback)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view, restart, press, state, focused])

  // the INPUT switch: requests a fresh payload set
  const handleInput = useCallback(() => {
    setInputBlink(true)
    window.setTimeout(() => setInputBlink(false), 380)
    restart()
  }, [restart])

  const handleSettingsChange = useCallback((patch: Partial<TestConfig>) => {
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  const handleSwapMode = useCallback(() => {
    setSettings((s) => ({ ...s, mode: s.mode === 'time' ? 'words' : 'time' }))
  }, [])

  const handleClearHistory = useCallback(() => {
    if (!window.confirm('delete all saved results? this cannot be undone.')) return
    clearResults()
      .then(() => setHistory([]))
      .catch((error) => console.error('failed to clear results', error))
  }, [])

  const toggleSound = useCallback(() => setSound((s) => !s), [])

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* ambient layers: phosphor grid + vignette + CRT sweep */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="grid-bg absolute inset-0 opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.6)_100%)]" />
        <div className="refresh-band absolute inset-0" />
      </div>

      <SysBar
        view={view}
        onViewChange={setView}
        sound={sound}
        onToggleSound={toggleSound}
        status={{
          breach: Math.round(progress),
          wpm: live.wpm,
          trace: traceLevel,
          running,
        }}
      />

      <main className="relative z-10 mx-auto w-full max-w-[1680px] flex-1 space-y-1.5 px-1.5 pb-2 pt-1.5 sm:px-2.5">
        {/* ── surveillance strip ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
          {CAMS.map((cam, i) => (
            <div
              key={cam}
              className={i < 2 ? '' : i < 4 ? 'hidden sm:block' : 'hidden lg:block'}
            >
              <div className="relative border border-terminal-border bg-terminal-bg">
                <div className="aspect-video">
                  <CctvFeed seed={i + 1} camId={cam} />
                </div>
              </div>
              <div className="crt-id flex justify-center py-1">
                <TallLabel className="font-mono text-[10px] leading-none tracking-[0.45em]">
                  {cam.replace('-', '')}
                </TallLabel>
              </div>
            </div>
          ))}
        </div>

        {/* ── operations band ────────────────────────────────────────── */}
        <div className="grid gap-1.5 lg:grid-cols-12">
          {/* left instruments */}
          <aside className="hidden min-h-0 flex-col gap-1.5 lg:col-span-3 lg:flex">
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-1.5">
              <Win seed={11} title="‼·€‼:‼-:▮:‼· ▌:▾" className="min-h-36">
                <AtomWidget energy={energy} />
              </Win>
              <Win seed={12} title="‼-·EUR:‼ ‼─·:" className="min-h-36">
                <KeyOsc wpm={running ? live.wpm : 0} />
              </Win>
            </div>
            <VisNine />
            <div className="flex items-stretch gap-1.5">
              <Win seed={13} title=":‼·:▸ ‼─:" className="h-12 flex-1">
                <TickerWindow seed={1} speed={30} />
              </Win>
              <V9Badge muted={!sound} onToggle={toggleSound} />
              <Win seed={14} title="▸‼─:· EUR:‼" className="h-12 flex-1">
                <TickerWindow seed={2} speed={44} />
              </Win>
            </div>
            <Win seed={15} title=":‼─‼·-·:‼ ▌‼─:‼·" className="min-h-44 flex-1">
              <WorldMapWindow />
            </Win>
          </aside>

          {/* center console — the breach */}
          <section className="flex min-h-0 min-w-0 flex-col gap-1.5 lg:col-span-6">
            {lesson && (
              <button
                type="button"
                onClick={() => handleSettingsChange({ lesson: null })}
                title="exit to free test"
                className="group flex flex-wrap items-center gap-x-2 gap-y-0.5 border border-terminal-accent/40 bg-terminal-accent/5 px-2 py-1 text-left font-mono text-[9px] tracking-[0.15em] transition-colors hover:border-terminal-accent/70"
              >
                <span className="text-terminal-accent glow">
                  ▶ {lessonChapter?.code ?? 'LESSON'}·{lesson.level} — {lesson.title.toUpperCase()}
                </span>
                <span className="text-terminal-text-dim">
                  · target {lesson.targetWpm} wpm @ {lesson.targetAcc}% — {lesson.hint}
                </span>
                <span className="ml-auto text-terminal-text-dim group-hover:text-terminal-text">
                  [exit ▸]
                </span>
              </button>
            )}
            <ModeBar
              config={settings}
              onChange={handleSettingsChange}
              sound={sound}
              onToggleSound={toggleSound}
            />
            <div className="win scan-lines relative flex min-h-72 flex-1 flex-col overflow-hidden">
              <div className="win-title relative z-10 flex items-center justify-between border-b border-terminal-border bg-terminal-panel/80 px-2 py-0.5">
                <span className="win-jamb">◄</span>
                <span className="font-mono text-[9px] tracking-widest text-terminal-text-dim">
                  111:1011100:01v9 — breach console:1001101
                </span>
                <span className="win-jamb">►</span>
              </div>
              <div className="relative z-10 flex-1 p-3 sm:p-5">
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.13]">
                  <BinaryWall seed={9} />
                </div>
                <div className="relative">
                  {state.finished ? (
                    <div className="animate-fade-in">
                      <Results
                        result={buildResult(state, settings)}
                        onNext={restart}
                        onRepeat={repeat}
                      />
                    </div>
                  ) : (
                    <TypeTest
                      state={state}
                      config={settings}
                      blurred={!focused}
                      onRestart={restart}
                      onWordsTap={coarse ? focusKeypad : undefined}
                    />
                  )}
                  {/* phone keypad port: tap the words to raise the keyboard */}
                  <CaptureInput mode="engine" ref={captureRef} onKey={handleVirtualKey} />
                </div>
              </div>
              <div className="relative z-10 border-t border-terminal-border/70">
                <BinaryStrip seed={5} height={14} />
              </div>
            </div>
            <SystemHud state={state} config={settings} />
          </section>

          {/* right instruments — decorative stack, desktop only */}
          <aside className="hidden min-h-0 min-w-0 flex-col gap-1.5 lg:col-span-3 lg:flex">
            <div className="hidden sm:block">
              <BinaryStrip seed={21} height={16} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Win seed={31} title="·‼:‼─:‼·:" className="min-h-28">
                <DialGauge value={dialWpm} max={160} label="WPM" />
              </Win>
              <Win seed={32} title="‼─:·‼:‼─" className="min-h-28">
                <DialGauge value={traceLevel} max={100} label="TRACE" />
              </Win>
            </div>
            <Win seed={33} title="▌‼─·:‼ ▼‼─:">
              <SwitchPanel sound={sound} onSound={setSound} onInput={handleInput} />
            </Win>
            {/* exfil progress */}
            <div className="win scan-lines px-2 py-1.5">
              <div className="flex items-center justify-between font-mono text-[9px] text-terminal-text-dim">
                <span className="tracking-[0.2em]">EXFIL</span>
                <span className="glow tabular-nums text-terminal-accent">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="mt-1 h-2 border border-terminal-border/70 bg-terminal-bg/70 p-px">
                <div
                  className="h-full bg-terminal-accent transition-[width] duration-150"
                  style={{ width: `${Math.max(progress, 1.5)}%` }}
                />
              </div>
              <div className="mt-1 truncate font-mono text-[8px] text-terminal-text-dim/70">
                {inputBlink
                  ? '»» REQUESTING NEW PAYLOAD SET…'
                  : '@data/min/new/target · aes-256 · 3 hops'}
              </div>
            </div>
            {/* tall ledger window */}
            <Win seed={35} title="‼·:‼─▌·:‼─·‼:—" className="min-h-56 flex-1">
              <Ledger
                state={state}
                onRestart={restart}
                onSwapMode={handleSwapMode}
                onToggleSound={toggleSound}
              />
            </Win>
          </aside>
        </div>

        {/* ── logic-board strip ──────────────────────────────────────── */}
        <div className="hidden gap-1.5 sm:grid sm:grid-cols-3 lg:grid-cols-5">
          {PCBS.map((name, i) => (
            <Win key={name} seed={40 + i} title={`${name}:${(i + 1) * 111}`} className="h-24 sm:h-28">
              <CircuitBoard seed={i + 2} />
            </Win>
          ))}
        </div>
      </main>

      {/* takeover views: lessons / arcade / archive slide over the dashboard */}
      {view !== 'breach' && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-terminal-bg/95 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-5xl overscroll-contain px-3 py-5 sm:px-4 sm:py-6">
            {view === 'lessons' && (
              <LessonsView
                activeLesson={settings.lesson ?? null}
                onSelect={(id) => {
                  handleSettingsChange({ lesson: id })
                  setView('breach')
                }}
                onClose={() => setView('breach')}
              />
            )}
            {view === 'arcade' && (
              <Arcade
                onClose={() => setView('breach')}
              />
            )}
            {view === 'archive' && (
              <div className="animate-fade-in">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="glow font-mono text-sm tracking-[0.3em] text-terminal-accent">
                      BREACH ARCHIVE
                    </h2>
                    <p className="mt-1 font-mono text-[11px] text-terminal-text-dim">
                      every finished session, newest first.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setView('breach')}
                    className="font-mono text-[10px] tracking-[0.3em] text-terminal-text-dim hover:text-terminal-accent"
                  >
                    &lt;&lt; RETURN TO BREACH / esc
                  </button>
                </div>
                <HistoryView history={history} onClear={handleClearHistory} />
              </div>
            )}
          </div>
        </div>
      )}

      <footer className="relative z-10 border-t border-terminal-border bg-terminal-bg/80 px-2 py-1.5 text-center font-mono text-[9px] tracking-[0.25em] text-terminal-text-dim">
        GH0ST.OPS ▮ don't look at your keyboard ▮{' '}
        {coarse
          ? 'tap the words to raise the keypad · buttons restart'
          : 'tab restart · enter next · esc abort'}
      </footer>
    </div>
  )
}
