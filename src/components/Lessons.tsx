import { useState } from 'react'
import { LESSONS, CHAPTERS, isCleared, lessonUnlocked, lessonIndex, chapterUnlocked, clearedCount } from '../lib/lessons'
import type { Chapter, Lesson, LessonId } from '../lib/lessons'
import { loadBests } from '../lib/bests'
import type { Bests } from '../lib/bests'
import { playKeySound } from '../lib/sound'

interface LessonsViewProps {
  /** currently active lesson (may be null = free test) */
  activeLesson: LessonId | null
  onSelect: (lessonId: LessonId | null) => void
  onClose: () => void
}

/** Best results for one lesson: cleared? best wpm + acc. */
function bestFor(bests: Bests, id: LessonId): { wpm: number; acc: number } {
  return {
    wpm: bests[`lesson:${id}:wpm`] ?? 0,
    acc: bests[`lesson:${id}:acc`] ?? 0,
  }
}

// ── key heatmap ───────────────────────────────────────────────────────

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** keyboard-latoured hotkeys per chapter id (letters are upper-case here) */
const CHAPTER_HEAT: Record<string, string[]> = {
  'home-base': 'ASDFGHJKL;EI'.split(''),
  'reach-curl': 'QWERTYUIOPZXCVBNM,./'.split(''),
  'full-board': LETTERS.split(''),
  wordcraft: LETTERS.split(''),
  'shift-discipline': LETTERS.split(''),
  'number-signal': [...'0123456789', '$', '%', ':', '-', '#', ',', '.', ';', '!', '?', '@', '/', '{', '}', '(', ')', '[', ']', '<', '>', '"', "'"],
  'prose-ops': [...LETTERS.split(''), '"', "'", ',', '.', '!', '?'],
  exams: [...LETTERS.split(''), ...'0123456789$%:#".\'?!'.split('')],
}

const KB_ROWS: string[][] = [
  LETTERS.slice(0, 10).split(''),
  LETTERS.slice(10, 19).split(''),
  LETTERS.slice(19, 26).split(''),
]

const ROW_STAGGER = ['0%', '6.5%', '13%']

function KeyCell({ label, hot }: { label: string; hot: boolean }) {
  return (
    <span
      className={`grid h-5 flex-1 place-items-center border font-mono text-[8px] leading-none sm:h-6 sm:text-[9px] ${
        hot
          ? 'border-terminal-accent/70 bg-terminal-accent/20 text-terminal-accent glow'
          : 'border-terminal-border/40 bg-terminal-panel/40 text-terminal-text-dim/40'
      }`}
    >
      {label}
    </span>
  )
}

/** Mini QWERTY map highlighting the keys a chapter trains. */
function KeyMap({ hot }: { hot: string[] }) {
  const set = new Set(hot.map((k) => k.toUpperCase()))
  const hasDigits = '0123456789'.split('').some((d) => set.has(d))
  const symbols = ';,./!?"\'-@#$%:(){}[]<>'.split('')
  const hotSymbols = symbols.filter((s) => set.has(s))

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-0.5 self-center py-1">
      {hasDigits && (
        <div className="flex gap-0.5">
          {'1234567890'.split('').map((d) => (
            <KeyCell key={d} label={d} hot={set.has(d)} />
          ))}
        </div>
      )}
      {KB_ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-0.5">
          <span className="shrink-0" style={{ width: ROW_STAGGER[ri] }} aria-hidden />
          {row.map((k) => (
            <KeyCell key={k} label={k} hot={set.has(k)} />
          ))}
        </div>
      ))}
      {hotSymbols.length > 0 && (
        <div className="flex justify-center gap-0.5">
          {hotSymbols.map((s) => (
            <span
              key={s}
              className="grid h-5 w-5 place-items-center border border-terminal-accent/70 bg-terminal-accent/20 font-mono text-[8px] text-terminal-accent glow sm:h-6"
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function heatForChapter(chapter: Chapter): string[] {
  return CHAPTER_HEAT[chapter.id] ?? []
}

// ── lesson card ───────────────────────────────────────────────────────

function LessonCard({
  lesson,
  bests,
  active,
  locked,
  prerequisite,
  onSelect,
}: {
  lesson: Lesson
  bests: Bests
  active: boolean
  locked: boolean
  prerequisite: string | null
  onSelect: () => void
}) {
  const best = bestFor(bests, lesson.id)
  const cleared = isCleared(lesson, bests)
  const wpmDone = best.wpm >= lesson.targetWpm
  const accDone = best.acc >= lesson.targetAcc

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={locked}
      className={`win scan-lines group relative flex flex-col p-3 text-left transition-colors ${
        active ? 'border-terminal-accent/80' : 'hover:border-terminal-accent/40'
      } ${locked ? 'cursor-not-allowed opacity-45 hover:border-terminal-border' : ''}`}
    >
      {/* level mark + cleared stamp */}
      <div className="mb-1.5 flex items-start justify-between">
        <span className="grid h-9 w-9 shrink-0 place-items-center border border-terminal-border bg-terminal-bg font-mono text-sm text-terminal-accent">
          <span style={{ transform: 'scale(1.5, 1.25)' }}>{lesson.level}</span>
        </span>
        {locked ? (
          <span className="border border-terminal-border/60 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.2em] text-terminal-text-dim/70">
            LOCKED
          </span>
        ) : cleared ? (
          <span className="border border-terminal-accent/60 bg-terminal-accent/15 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.2em] text-terminal-accent glow">
            CLEARED
          </span>
        ) : wpmDone || accDone ? (
          <span className="border border-terminal-warning/50 bg-terminal-warning/10 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.2em] text-terminal-warning">
            PARTIAL
          </span>
        ) : (
          <span className="font-mono text-[9px] tracking-[0.2em] text-terminal-text-dim/60">
            TARGET: {lesson.targetWpm}·{lesson.targetAcc}%
          </span>
        )}
      </div>

      <div className="font-mono text-[13px] font-bold tracking-wide text-terminal-text group-hover:text-terminal-accent">
        {lesson.title}
      </div>
      <p className="mt-1 font-mono text-[10px] leading-snug text-terminal-text-dim">
        {lesson.blurb}
      </p>

      {/* keyboard chips */}
      <div className="mt-2 flex flex-wrap gap-1">
        {lesson.keys.map((k) => (
          <kbd key={k} className="kbd">
            {k}
          </kbd>
        ))}
      </div>

      {/* best telemetry */}
      <div className="mt-3 flex items-center justify-between border-t border-terminal-border/60 pt-2 font-mono text-[9px] tabular-nums text-terminal-text-dim">
        <span>
          best{' '}
          <span className={wpmDone ? 'text-terminal-accent' : 'text-terminal-text'}>
            {best.wpm > 0 ? `${Math.round(best.wpm)}wpm` : '—'}
          </span>
        </span>
        <span>
          <span className={accDone ? 'text-terminal-accent' : 'text-terminal-text'}>
            {best.acc > 0 ? `${best.acc}%` : '—'}
          </span>{' '}
          acc
        </span>
      </div>
      {active && (
        <span className="absolute right-2 top-8 font-mono text-[8px] tracking-[0.25em] text-terminal-accent/80">
          ▶ ACTIVE
        </span>
      )}
      {locked && prerequisite && (
        <span className="absolute bottom-10 left-3 right-3 font-mono text-[8px] leading-snug tracking-[0.12em] text-terminal-text-dim/80">
          ▐ clear “{prerequisite}” to unlock
        </span>
      )}
    </button>
  )
}

// ── the takeover view ─────────────────────────────────────────────────

export function LessonsView({ activeLesson, onSelect, onClose }: LessonsViewProps) {
  // localStorage read is synchronous + cheap → init directly at mount
  const [bests, setBests] = useState<Bests>(() => loadBests())

  // active chapter: the one containing the active lesson, else first unlocked
  const [chapterId, setChapterId] = useState<string>(() => {
    const active = activeLesson ? LESSON_CHAPTER(activeLesson) : null
    return active ?? 'home-base'
  })

  const start = (id: LessonId | null): void => {
    playKeySound({ kind: 'space', correct: true })
    setBests(loadBests())
    onSelect(id)
  }

  const chapter = CHAPTERS.find((c) => c.id === chapterId) ?? CHAPTERS[0]
  const progress = clearedCount(bests)
  const total = LESSONS.length
  const heat = heatForChapter(chapter)

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-mono text-sm tracking-[0.3em] text-terminal-accent glow">
            BREACH TRAINING CURRICULUM
          </h2>
          <p className="mt-1 max-w-2xl font-mono text-[11px] leading-relaxed text-terminal-text-dim">
            {total} drills across {CHAPTERS.length} chapters take you from the
            home row to graduation exams. Clear a lesson at its target speed
            &amp; accuracy to unlock the next; selecting a drill re-arms the
            breach console with its payload.
          </p>
          <div className="mt-2 flex items-center gap-2 font-mono text-[10px] tabular-nums text-terminal-text-dim">
            <span className="tracking-[0.2em]">PROGRESS</span>
            <div className="h-2 w-40 border border-terminal-border/70 bg-terminal-bg/70 p-px sm:w-56">
              <div
                className="h-full bg-terminal-accent"
                style={{ width: `${Math.max((progress / total) * 100, 1.5)}%` }}
              />
            </div>
            <span className="text-terminal-accent glow">
              {progress}/{total}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[10px] tracking-[0.3em] text-terminal-text-dim hover:text-terminal-accent"
        >
          &lt;&lt; RETURN TO BREACH / esc
        </button>
      </div>

      {/* chapter pills */}
      <div className="scrollbar-hide -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {CHAPTERS.map((c) => {
          const unlocked = chapterUnlocked(c, bests)
          const clearedInChapter = c.lessons.filter((l) => isCleared(l, bests)).length
          const isActive = c.id === chapter.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setChapterId(c.id)}
              className={`shrink-0 border px-2.5 py-1.5 text-left font-mono transition-colors ${
                isActive
                  ? 'border-terminal-accent/70 bg-terminal-accent/15 glow text-terminal-accent'
                  : unlocked
                    ? 'border-terminal-border text-terminal-text-dim hover:border-terminal-accent/40 hover:text-terminal-text'
                    : 'border-terminal-border/50 text-terminal-text-dim/50'
              }`}
            >
              <span className="block text-[9px] tracking-[0.25em]">
                {unlocked ? c.code : '▐▐'} {c.title}
              </span>
              <span className="mt-0.5 block text-[8px] tracking-[0.2em] opacity-80">
                {clearedInChapter}/{c.lessons.length} cleared
              </span>
            </button>
          )
        })}
      </div>

      {/* chapter header + keymap */}
      <div className="win scan-lines mb-3 flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[9px] tracking-[0.3em] text-terminal-text-dim">
            {chapter.code}
          </div>
          <div className="font-mono text-sm font-bold tracking-[0.2em] text-terminal-text">
            {chapter.title}
          </div>
          <p className="mt-1 font-mono text-[10px] leading-snug text-terminal-text-dim">
            {chapter.tagline}
          </p>
        </div>
        <KeyMap hot={heat} />
      </div>

      {/* lesson cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {chapter.lessons.map((lesson) => {
          const idx = lessonIndex(lesson.id)
          const unlocked = lessonUnlocked(idx, bests)
          const prev = idx > 0 ? LESSONS[idx - 1] : null
          return (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              bests={bests}
              active={lesson.id === activeLesson}
              locked={!unlocked}
              prerequisite={prev?.title ?? null}
              onSelect={() => start(lesson.id)}
            />
          )
        })}
        {/* free test card */}
        <button
          type="button"
          onClick={() => start(null)}
          className="win scan-lines flex flex-col p-3 text-left hover:border-terminal-accent/40"
        >
          <div className="mb-1.5 grid h-9 w-9 place-items-center border border-terminal-border bg-terminal-bg font-mono text-sm text-terminal-text-dim">
            <span style={{ transform: 'scale(1.5, 1.25)' }}>∞</span>
          </div>
          <div className="font-mono text-[13px] font-bold tracking-wide text-terminal-text-dim hover:text-terminal-accent">
            Free Test
          </div>
          <p className="mt-1 font-mono text-[10px] leading-snug text-terminal-text-dim/70">
            Drop the curriculum — random payloads, your own mode settings.
          </p>
          <div className="mt-3 border-t border-terminal-border/60 pt-2 font-mono text-[9px] tracking-[0.2em] text-terminal-text-dim/60">
            {activeLesson === null ? '▶ ACTIVE' : 'raw mode'}
          </div>
        </button>
      </div>
    </div>
  )
}

function LESSON_CHAPTER(id: LessonId): string | null {
  for (const c of CHAPTERS) {
    if (c.lessons.some((l) => l.id === id)) return c.id
  }
  return null
}
