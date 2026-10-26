# ghost-terminal

A terminal-styled typing trainer with a hacker-ops dashboard. Type the words as
fast and accurately as you can — every keystroke is graded live, every finished
test is saved to your browser. Works with hardware keyboards **and with the
on-screen keypad of phones and tablets**.

## Features

- **Time mode** — 15 / 30 / 60 / 120 second sprints with an endless word buffer
- **Words mode** — 10 / 25 / 50 / 100 word tests
- **Modifiers** — optional punctuation and numbers
- **Lessons** — chaptered training curriculum: home row → reach keys → full
  board → words → symbols → graduation exams; lessons unlock as targets are met
- **Arcade** — eight keyboard-driven cabinets (Invaders, Tracer, Pulse-Key,
  Defuse, Ghost Chase, Word Brawler, Ghost Duel, Letter Storm) with persistent
  high scores
- **Hacker dashboard theme** — phosphor-CRT look with scanlines, vignette and a
  drifting CRT refresh band
- **Live breach telemetry** — a HUD of system parameters that goes erratic
  while you type
- **Typewriter sound** — mechanical keystroke clacks synthesized live with the
  Web Audio API; toggleable in the mode bar
- **Live feedback** — per-character coloring, animated caret, live WPM & accuracy
- **Results** — WPM/raw/accuracy/consistency plus a per-second WPM chart
- **History** — every test saved to IndexedDB; trend chart, personal best and
  average of your last 10 tests
- **Settings persistence** — mode and modifier preferences are remembered
  (localStorage)

## Keyboard & phone support

- **Desktop / hardware keyboard** — typing is captured globally: `tab`/`esc`
  restart, `enter` for the next test; typing auto-pauses when the window loses
  focus.
- **Phone / tablet keypad** — tap the words to raise the on-screen keypad. An
  invisible capture input takes the keypad's edits and diffs them into the
  exact same keystroke stream the engine knows (including backspaces and
  keypad autocorrect rewrites). Restart works with the on-screen buttons.
- **Arcade on touch devices** — same plumbing: tap the arena to raise the
  keypad and the cabinets play identically. Some cabinets are easier with a
  hardware keyboard (symbol-heavy Defuse in particular), but every game is
  playable.

## Stack

- [React 19](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vite.dev) for dev server & builds
- [Tailwind CSS](https://tailwindcss.com) with a custom terminal theme
- [Recharts](https://recharts.org) for the results/history charts
- [idb](https://github.com/jakearchibald/idb) (IndexedDB) for result storage
- [Vitest](https://vitest.dev) for the core engine tests

## Getting started

```bash
npm install
npm run dev      # start the dev server
```

## Scripts

| Script             | Description                        |
| ------------------ | ---------------------------------- |
| `npm run dev`      | Start the Vite dev server          |
| `npm run build`    | Type-check and build for production|
| `npm run preview`  | Preview the production build       |
| `npm run test`     | Run unit tests once                |
| `npm run test:watch` | Run unit tests in watch mode     |
| `npm run lint`     | Lint with oxlint                   |

## Project structure

```
src/
  lib/
    words.ts            word pool + test-word generator
    engine.ts           typing state machine, metrics, results
    sound.ts            Web Audio typewriter sounds (clack, error, bell)
    storage.ts          IndexedDB history + settings persistence
    device.ts           touch-only device sniffing
    virtualKey.ts       keypad diff → keystrokes, synthetic key events
    lessons.ts          lesson/chapter curriculum + drills
    bests.ts            persistent personal bests (lessons + arcade)
  hooks/
    useTypingTest.ts    React binding for the engine
  components/
    CaptureInput.tsx    invisible phone-keypad port (diff source of truth)
    ModeBar.tsx         mode/duration/modifier selection
    TypeTest.tsx        words area, caret, live stats
    Results.tsx         finished-test stats + chart
    History.tsx         history table, trend chart, personal best
    Lessons.tsx         training curriculum takeover
    Arcade.tsx          arcade hall + cabinet host
    Header.tsx          brand + view navigation
    Footer.tsx          shortcuts
    SystemHud.tsx       fake system telemetry strip
  components/dashboard/ window widgets (gauges, maps, ledger, CCTV …)
  components/arcade/    the eight arcade cabinets
  App.tsx               composition + global keyboard handling

```

## Notes

- Results are stored locally in your browser (IndexedDB). Clearing site data
  clears your history and settings.
- The responsive layout collapses the dashboard to the essentials on small
  screens (console + HUD first), so the typing area is front and center.
