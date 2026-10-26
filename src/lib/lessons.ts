import { COMMON_WORDS } from './words'
import type { Bests } from './bests'

/**
 * The breach training curriculum: eight chapters of progressive lessons
 * that take a fresh recruit from the home row all the way to full prose
 * under exam pressure. Lessons are strictly sequential — the next drill
 * unlocks when the previous one is cleared.
 *
 * Each lesson owns a "drill" — a seeded word factory whose output feeds
 * the normal test engine, so lessons run in the same breach console as
 * free tests. Lesson ids that existed in v1 (home-row, top-row, …) are
 * kept identical so returning operators keep their progress.
 */

export type LessonId =
  | 'home-row'
  | 'home-bigrams'
  | 'home-extend'
  | 'home-words'
  | 'top-row'
  | 'bottom-row'
  | 'rows-mix'
  | 'alphabet'
  | 'doubles'
  | 'bigrams'
  | 'easy-words'
  | 'common-words'
  | 'long-words'
  | 'capitals'
  | 'proper-nouns'
  | 'acronyms'
  | 'numbers'
  | 'dates-money'
  | 'symbols'
  | 'code-tokens'
  | 'sentences'
  | 'quotes'
  | 'prose'
  | 'sprint'
  | 'gauntlet'
  | 'pangrams'

export interface Lesson {
  id: LessonId
  /** chapter this drill belongs to */
  chapter: string
  /** global lesson number, roman — stable for display */
  level: string
  title: string
  /** the key coverage, shown as keyboard chips / heatmap */
  keys: string[]
  blurb: string
  /** posture / finger guidance shown inside the console banner */
  hint: string
  /** WPM needed to clear the lesson (with targetAcc) */
  targetWpm: number
  targetAcc: number
  /** produces one drill "word" per call */
  drill: (rng: () => number) => string
}

export interface Chapter {
  id: string
  code: string
  title: string
  tagline: string
  lessons: Lesson[]
}

const pick = <T,>(rng: () => number, pool: T[]): T =>
  pool[Math.floor(rng() * pool.length)]

/** Builds a drill chunk of 1..max characters drawn from a key pool. */
function chunk(rng: () => number, pool: string[], max = 3): string {
  const len = 1 + Math.floor(rng() * max)
  let out = ''
  for (let i = 0; i < len; i++) out += pick(rng, pool)
  return out
}

/** Doubled-pair drills like "ffjj" teach alternating hand rhythm. */
function pairs(rng: () => number, pool: string[]): string {
  const a = pick(rng, pool)
  const b = pick(rng, pool)
  return rng() < 0.5 ? `${a}${a}${b}${b}` : `${a}${b}${a}${b}`
}

/** Filters the word pool once, at module load, by predicate. */
const wordsWhere = (pred: (w: string) => boolean): string[] => {
  const out = COMMON_WORDS.filter(pred)
  return out.length > 0 ? out : COMMON_WORDS
}

/** All letters of `w` must belong to the allowed alphabet. */
const onlyLetters = (w: string, allowed: string): boolean => {
  for (const ch of w) if (!allowed.includes(ch)) return false
  return true
}

const cap = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1)

// ── reusable stat pools ───────────────────────────────────────────────

const EASY_WORD_MAX = 6
const easyWords = wordsWhere((w) => w.length >= 2 && w.length <= EASY_WORD_MAX)
const commonBases = wordsWhere((w) => w.length >= 3 && w.length <= 9)
const longBases = wordsWhere((w) => w.length >= 6 && w.length <= 10)
const doubleBases = wordsWhere((w) => w.length <= 7 && /(.)\1/.test(w))

/** Real words spelled entirely with home-row + extended anchor letters. */
const HOME_ALPHABET = 'asdfghjklei'
const homeWords = wordsWhere(
  (w) => w.length >= 2 && w.length <= 6 && onlyLetters(w, HOME_ALPHABET),
)

const topChunks = 'qwertyuiop'.split('')

const bottomChunks = 'zxcvbnm,./'.split('')

const BIGRAMS = [
  'th', 'he', 'in', 'er', 'an', 're', 'on', 'at', 'en', 'nd', 'ti', 'es',
  'or', 'te', 'of', 'ed', 'is', 'it', 'al', 'ar', 'st', 'se', 'ha', 'ou',
]

const PROPER_NOUNS = [
  'Ada', 'Neo', 'Berlin', 'Cairo', 'Oslo', 'Tokyo', 'Lagos', 'Denver',
  'Sydney', 'Vienna', 'Jakarta', 'Havana', 'Moscow', 'Dublin', 'Kyoto',
  'Naples', 'Warsaw', 'Lisbon', 'Detroit', 'Liverpool', 'Marseille',
  'Kobayashi', 'Novak', 'sierra', 'Tango', 'Whiskey', 'Zulu', 'Foxtrot',
]

const ACRONYMS = [
  'NASA', 'HTML', 'UFO', 'CEO', 'API', 'GPS', 'RAM', 'FBI', 'NATO',
  'OK', 'ID', 'USB', 'LAN', 'CPU', 'HTML5', '3D', 'Wi-Fi', 'AI', 'DNA',
  'GPU', 'KILO', 'OSS',
]

const CONTRACTIONS = [
  "don't", "it's", "can't", "you're", "won't", "isn't", "I'm", "we're",
  "didn't", "she'd", "he'll", "what's", "there's", "isn't", "aren't",
]

const PANGRAMS: string[][] = [
  'the quick brown fox jumps over the lazy dog'.split(' '),
  'pack my box with five dozen liquor jugs'.split(' '),
  'sphinx of black quartz judge my vow'.split(' '),
  'how vexingly quick daft zebras jump'.split(' '),
  'the five boxing wizards jump quickly'.split(' '),
  'glib jocks quiz nymph by vexing waltz'.split(' '),
]

const SYMBOLS = [',', '.', ';', '/', '!', '?', '-', '@', '#', "'"]

/** code letters that pair with bracket tokens */
const CODE_LETTERS = 'acdefhiklmnoprstuwxyz'.split('')

// ── chapter definitions ───────────────────────────────────────────────

interface LessonSpec extends Omit<Lesson, 'chapter' | 'level'> {}

const CHAPTER_DEFS: Array<Omit<Chapter, 'lessons'> & { lessons: LessonSpec[] }> = [
  {
    id: 'home-base',
    code: 'CH.1',
    title: 'HOME BASE',
    tagline: 'anchor on the bumps of F and J — everything starts here',
    lessons: [
      {
        id: 'home-row',
        title: 'Home Row Basics',
        keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';'],
        blurb: 'Anchor your fingers on the home row. Feel the bumps on F and J.',
        hint: 'curve each finger over its key and return home after every stroke.',
        targetWpm: 12,
        targetAcc: 90,
        drill: (rng) =>
          rng() < 0.4
            ? pairs(rng, ['a', 's', 'd', 'f', 'j', 'k', 'l', ';'])
            : chunk(rng, ['a', 's', 'd', 'f', 'j', 'k', 'l', ';']),
      },
      {
        id: 'home-bigrams',
        title: 'Home Row Rolls',
        keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';'],
        blurb: 'Two- and three-key rolls along the row — build the rhythm.',
        hint: 'keep the wrists floating; the motion comes from the fingers, not the arm.',
        targetWpm: 14,
        targetAcc: 92,
        drill: (rng) => {
          const roll = rng()
          if (roll < 0.25) return pairs(rng, ['s', 'd', 'j', 'k'])
          if (roll < 0.6) {
            // adjacent-finger rolls like "sd" / "lk"
            const left = rng() < 0.5 ? 'asdf'.split('') : 'jkl;'.split('')
            const idx = Math.floor(rng() * (left.length - 1))
            return rng() < 0.5
              ? `${left[idx]}${left[idx + 1]}`
              : `${left[idx + 1]}${left[idx]}`
          }
          return chunk(rng, ['a', 's', 'd', 'f', 'j', 'k', 'l', ';'], 4)
        },
      },
      {
        id: 'home-extend',
        title: 'Home + E, I, G, H',
        keys: ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'e', 'i', ';'],
        blurb: 'Stretch to G, H, E and I without leaving the home anchor.',
        hint: 'index fingers own G and H; E and I belong to the middle fingers reaching up.',
        targetWpm: 16,
        targetAcc: 90,
        drill: (rng) =>
          rng() < 0.3
            ? pairs(rng, ['e', 'i', 'g', 'h'])
            : chunk(rng, ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', 'e', 'i']),
      },
      {
        id: 'home-words',
        title: 'Home Row Words',
        keys: ['a…z (home)'],
        blurb: 'Real words that live on the anchors — the first taste of vocabulary.',
        hint: 'say the word in your head; let the fingers echo the letters.',
        targetWpm: 20,
        targetAcc: 92,
        drill: (rng) => pick(rng, homeWords) ?? 'said',
      },
    ],
  },
  {
    id: 'reach-curl',
    code: 'CH.2',
    title: 'REACH & CURL',
    tagline: 'reach up to the top row, curl down to the bottom row',
    lessons: [
      {
        id: 'top-row',
        title: 'Top Row',
        keys: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        blurb: 'Reach up from the anchors. Q and P are the far walls.',
        hint: 'hinge from the knuckles, not the wrist — and always re-anchor after Q or P.',
        targetWpm: 16,
        targetAcc: 90,
        drill: (rng) =>
          rng() < 0.3
            ? pairs(rng, ['q', 'p', 't', 'y'])
            : chunk(rng, topChunks, 4),
      },
      {
        id: 'bottom-row',
        title: 'Bottom Row',
        keys: ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.'],
        blurb: 'Curl down. Z, B and M trip most operators — own them.',
        hint: 'curl from the middle knuckle; B is a shared key — use whichever index feels right.',
        targetWpm: 15,
        targetAcc: 88,
        drill: (rng) =>
          rng() < 0.3
            ? pairs(rng, ['z', 'x', 'c', 'v', 'b', 'n', 'm'])
            : chunk(rng, bottomChunks, 4),
      },
      {
        id: 'rows-mix',
        title: 'Row Crossings',
        keys: ['QWERTY + ZXCV'],
        blurb: 'Top and bottom rows interleaved — vertical travel without drifting.',
        hint: 'think in V shapes: up to the top, home, down to the bottom.',
        targetWpm: 18,
        targetAcc: 90,
        drill: (rng) => {
          const top = chunk(rng, topChunks, 2)
          const bottom = chunk(rng, bottomChunks, 2)
          return rng() < 0.5 ? `${top}${bottom}` : `${bottom}${top}`
        },
      },
    ],
  },
  {
    id: 'full-board',
    code: 'CH.3',
    title: 'FULL BOARD',
    tagline: 'all 26 letters at speed — the alphabet becomes one instrument',
    lessons: [
      {
        id: 'alphabet',
        title: 'Full Alphabet Drills',
        keys: ['A…Z'],
        blurb: 'Random letter formations across the whole board.',
        hint: 'eyes on screen, hands loose. hunting keys kills speed.',
        targetWpm: 20,
        targetAcc: 90,
        drill: (rng) => chunk(rng, 'abcdefghijklmnopqrstuvwxyz'.split(''), 5),
      },
      {
        id: 'doubles',
        title: 'Double Letters',
        keys: ['A…Z · ll'],
        blurb: 'Hall, balloon, letter — train the double-tap reflex.',
        hint: 'for doubles, strike twice from the same finger — do not re-scan the keyboard.',
        targetWpm: 22,
        targetAcc: 90,
        drill: (rng) => {
          const roll = rng()
          if (roll < 0.25) {
            const dbl = pick(rng, ['ll', 'ss', 'tt', 'ee', 'oo', 'ff', 'rr', 'nn', 'pp'])
            return `${dbl}${pick(rng, commonBases.slice(0, 40))}`
          }
          return pick(rng, doubleBases) ?? 'letter'
        },
      },
      {
        id: 'bigrams',
        title: 'Common Bigrams',
        keys: ['th · he · in er'],
        blurb: 'The letter pairs English breathes with — th, he, in, er and friends.',
        hint: 'bigrams are finger chords: type TH and IN as single pulses.',
        targetWpm: 24,
        targetAcc: 90,
        drill: (rng) => {
          const n = 1 + Math.floor(rng() * 3)
          let out = ''
          for (let i = 0; i < n; i++) out += pick(rng, BIGRAMS)
          return out
        },
      },
    ],
  },
  {
    id: 'wordcraft',
    code: 'CH.4',
    title: 'WORDCRAFT',
    tagline: 'from three-letter stubs to ten-letter freight trains',
    lessons: [
      {
        id: 'easy-words',
        title: 'Short Real Words',
        keys: ['a…z'],
        blurb: 'Real vocabulary, two to six letters. Start spelling by memory.',
        hint: 'read a word ahead of your fingers — buffer what comes next.',
        targetWpm: 26,
        targetAcc: 92,
        drill: (rng) => pick(rng, easyWords) ?? 'the',
      },
      {
        id: 'common-words',
        title: 'Common Words',
        keys: ['a…z'],
        blurb: 'The highest-frequency English words — the bread of real typing.',
        hint: 'rock the whole hand per word; let rhythm carry the speed.',
        targetWpm: 32,
        targetAcc: 93,
        drill: (rng) => pick(rng, COMMON_WORDS),
      },
      {
        id: 'long-words',
        title: 'Six to Ten Letters',
        keys: ['a…z · long'],
        blurb: 'Long freight-train words — discipline for the pinky and ring fingers.',
        hint: 'long words are pace anchors: slow slightly, keep every letter landing.',
        targetWpm: 28,
        targetAcc: 92,
        drill: (rng) => pick(rng, longBases) ?? 'information',
      },
    ],
  },
  {
    id: 'shift-discipline',
    code: 'CH.5',
    title: 'SHIFT DISCIPLINE',
    tagline: 'caps lock is for amateurs — learn the opposite-hand shift trick',
    lessons: [
      {
        id: 'capitals',
        title: 'Initial Capitals',
        keys: ['⇧ + A…Z'],
        blurb: 'The Quick Brown Fox pattern — shift with the opposite pinky.',
        hint: 'hold shift with the hand that is NOT typing the letter.',
        targetWpm: 26,
        targetAcc: 92,
        drill: (rng) => {
          const w = pick(rng, commonBases)
          return rng() < 0.88 ? cap(w) : w
        },
      },
      {
        id: 'proper-nouns',
        title: 'Proper Nouns',
        keys: ['⇧ · names'],
        blurb: 'Berlin, Kobayashi, Foxtrot — people and places with odd silhouettes.',
        hint: 'names get mis-guessed — commit to mouse-eye reading, then strike.',
        targetWpm: 24,
        targetAcc: 90,
        drill: (rng) => pick(rng, PROPER_NOUNS),
      },
      {
        id: 'acronyms',
        title: 'Acronyms & Tags',
        keys: ['⇧ · hybrid'],
        blurb: 'NASA, HTML5, Wi-Fi — shouty chips and hyphen hybrids.',
        hint: 'acronyms are shift-storms: brace with the resting pinky and release between glyphs.',
        targetWpm: 24,
        targetAcc: 88,
        drill: (rng) => {
          if (rng() < 0.7) return pick(rng, ACRONYMS)
          return rng() < 0.5 ? cap(pick(rng, COMMON_WORDS)) : pick(rng, ['3D', 'OK', 'ID'])
        },
      },
    ],
  },
  {
    id: 'number-signal',
    code: 'CH.6',
    title: 'NUMBER SIGNAL',
    tagline: 'numbers, money, code fragments — the keyboard’s second deck',
    lessons: [
      {
        id: 'numbers',
        title: 'Number Row',
        keys: ['0', '…', '9', '—'],
        blurb: 'Reach to the number row. Palms stay planted, fingers do the work.',
        hint: 're-anchor after every number — the row above is the quickest drift zone.',
        targetWpm: 24,
        targetAcc: 90,
        drill: (rng) => {
          const roll = rng()
          if (roll < 0.4) return String(Math.floor(rng() * 90) + 10)
          if (roll < 0.7) return String(Math.floor(rng() * 9999))
          return `${pick(rng, 'abcdefghjklmnpqrstuvwxyz'.split(''))}${Math.floor(rng() * 90) + 10}`
        },
      },
      {
        id: 'dates-money',
        title: 'Dates & Money',
        keys: ['0-9 · $%:'],
        blurb: 'Timestamps, invoices, coordinates — the shape of real data.',
        hint: 'numbers and separators alternate hands: keep the rhythm metronomic.',
        targetWpm: 24,
        targetAcc: 88,
        drill: (rng) => {
          const roll = rng()
          if (roll < 0.18) return `${Math.floor(rng() * 90) + 10}.${Math.floor(rng() * 90) + 10}`
          if (roll < 0.36) return `$${Math.floor(rng() * 900) + 100}.${Math.floor(rng() * 90) + 10}`
          if (roll < 0.54) {
            const y = 2020 + Math.floor(rng() * 10)
            const m = String(1 + Math.floor(rng() * 12)).padStart(2, '0')
            const d = String(1 + Math.floor(rng() * 28)).padStart(2, '0')
            return `${y}-${m}-${d}`
          }
          if (roll < 0.72) return `${Math.floor(rng() * 800) + 200}-0${Math.floor(rng() * 900) + 100}`
          if (roll < 0.84) return `${Math.floor(rng() * 23)}:${String(Math.floor(rng() * 60)).padStart(2, '0')}`
          if (roll < 0.92) return `${Math.floor(rng() * 100)}%`
          return `#${Math.floor(rng() * 9) + 1}`
        },
      },
      {
        id: 'symbols',
        title: 'Symbols & Punctuation',
        keys: [';', ',', '.', '/', '!', '?', '-', '@', '#'],
        blurb: 'Code and prose punctuation. Shift discipline starts paying off.',
        hint: '! @ # % live above the left hand — anchor before, return after.',
        targetWpm: 20,
        targetAcc: 88,
        drill: (rng) => {
          const a = pick(rng, CODE_LETTERS)
          const b = pick(rng, CODE_LETTERS)
          const sym = pick(rng, SYMBOLS)
          const roll = rng()
          if (roll < 0.34) return `${a}${sym}${b}`
          if (roll < 0.67) return `${a}${b}${sym}`
          return `${pick(rng, ['{', '(', '[', '<'])}${a}${b}${pick(rng, ['}', ')', ']', '>'])}`
        },
      },
      {
        id: 'code-tokens',
        title: 'Brackets & Code',
        keys: ['{} [] () <>'],
        blurb: 'Fragments from the machine language: predicates, arrays, calls.',
        hint: 'brackets travel in pairs — type the close with the same finger that opened it.',
        targetWpm: 22,
        targetAcc: 88,
        drill: (rng) => {
          const a = pick(rng, CODE_LETTERS)
          const roll = rng()
          if (roll < 0.12) return `${a}=(${Math.floor(rng() * 9) + 1})`
          if (roll < 0.24) return `if(${a})`
          if (roll < 0.36) return `[${Math.floor(rng() * 99)}]`
          if (roll < 0.48) return `<${pick(rng, ['div', 'span', 'pre', 'sys'])}>`
          if (roll < 0.6) return `{${a},${pick(rng, CODE_LETTERS)}}`
          if (roll < 0.72) return `${a}==${rng() < 0.5 ? a : (Math.floor(rng() * 9) + 1)}`
          if (roll < 0.84) return `${pick(rng, ['&&', '||', '??'])}`
          if (roll < 0.92) return '...'
          return `${a}(x,${Math.floor(rng() * 9) + 1});`
        },
      },
    ],
  },
  {
    id: 'prose-ops',
    code: 'CH.7',
    title: 'PROSE OPS',
    tagline: 'sentences, quotes, flow — where speed becomes expression',
    lessons: [
      {
        id: 'sentences',
        title: 'Full Sentences',
        keys: ['ALL'],
        blurb: 'Common words with natural punctuation. The first breach drill.',
        hint: 'vary the internal pace: sprint short words, steady on the long ones.',
        targetWpm: 40,
        targetAcc: 94,
        drill: (rng) => {
          const word = pick(rng, COMMON_WORDS)
          if (rng() < 0.06) return cap(word)
          if (rng() < 0.1) return `${word}${pick(rng, [',', '.', ';', ':', '!', '?'])}`
          return word
        },
      },
      {
        id: 'quotes',
        title: 'Quotes & Contractions',
        keys: ['" \' ?'],
        blurb: 'Apostrophes, possessives and quoted phrases — the tricky finger tangles.',
        hint: `the apostrophe is ring-finger up; let it interrupt flow, then rebound instantly.`,
        targetWpm: 30,
        targetAcc: 92,
        drill: (rng) => {
          const roll = rng()
          if (roll < 0.5) return pick(rng, CONTRACTIONS)
          if (roll < 0.8) return `"${pick(rng, COMMON_WORDS)}"`
          return `${cap(pick(rng, COMMON_WORDS))}'s`
        },
      },
      {
        id: 'prose',
        title: 'Prose Flow',
        keys: ['ALL'],
        blurb: 'Everything the prose chapters taught, blended at natural ratios.',
        hint: 'pretend you are transcribing dispatch — read two words ahead, type one.',
        targetWpm: 42,
        targetAcc: 94,
        drill: (rng) => {
          const word = pick(rng, COMMON_WORDS)
          const roll = rng()
          if (roll < 0.08) return cap(word)
          if (roll < 0.16) return `${word}${pick(rng, [',', '.', '!', '?'])}`
          if (roll < 0.22) return pick(rng, CONTRACTIONS)
          if (roll < 0.26) return `"${word}"`
          return word
        },
      },
    ],
  },
  {
    id: 'exams',
    code: 'CH.8',
    title: 'PHANTOM EXAMS',
    tagline: 'graduation trials — nothing left to hide behind',
    lessons: [
      {
        id: 'sprint',
        title: 'Sprint Exam',
        keys: ['a…z · pace'],
        blurb: 'Pure common words at speed. The clock forgives nothing.',
        hint: 'sprint on freight, breathe on four-letter words, never full stop.',
        targetWpm: 50,
        targetAcc: 94,
        drill: (rng) => pick(rng, commonBases),
      },
      {
        id: 'gauntlet',
        title: 'Full Gauntlet',
        keys: ['ALL · mixed'],
        blurb: 'Capitals, symbols, numbers and words — the full hostile alphabet.',
        hint: 'the gauntlet mixes hand zones intentionally — anchor between each zone swap.',
        targetWpm: 36,
        targetAcc: 92,
        drill: (rng) => {
          const word = pick(rng, COMMON_WORDS)
          const roll = rng()
          if (roll < 0.14) return cap(word)
          if (roll < 0.24) return String(Math.floor(rng() * 9999))
          if (roll < 0.34) return `${word}${pick(rng, [',', '.', '!', '?', ';'])}`
          if (roll < 0.42) return pick(rng, ACRONYMS)
          if (roll < 0.48) return `$${Math.floor(rng() * 900) + 100}`
          if (roll < 0.54) return `"${word}"`
          if (roll < 0.58) return pick(rng, CONTRACTIONS)
          return word
        },
      },
      {
        id: 'pangrams',
        title: 'Pangram Finale',
        keys: ['A…Z × every glyph'],
        blurb: 'Words mined from classic pangrams — every glyph tasting order chaos.',
        hint: 'pangrams hide rare neighbours — last drill: trust the buffers, not the eyes.',
        targetWpm: 38,
        targetAcc: 92,
        drill: (rng) => {
          const pg = PANGRAMS[Math.floor(rng() * PANGRAMS.length)]
          return pick(rng, pg)
        },
      },
    ],
  },
]

// flatten into ordered structures
const ROMAN = [
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
  'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII',
  'XXIII', 'XXIV', 'XXV', 'XXVI',
]

export const CHAPTERS: Chapter[] = CHAPTER_DEFS.map((ch) => ({
  ...ch,
  lessons: ch.lessons.map((spec, i) => ({
    ...spec,
    chapter: ch.id,
    level: ROMAN[i] ?? String(i + 1),
  })),
})) as Chapter[]

export const LESSONS: Lesson[] = CHAPTERS.flatMap((c) => c.lessons)

export const LESSON_BY_ID = new Map<string, Lesson>(LESSONS.map((l) => [l.id, l]))
const LESSON_INDEX = new Map<string, number>(LESSONS.map((l, i) => [l.id, i]))

export const CHAPTER_BY_ID = new Map<string, Chapter>(CHAPTERS.map((c) => [c.id, c]))

export function lessonById(id: string | null | undefined): Lesson | null {
  if (!id) return null
  return LESSON_BY_ID.get(id) ?? null
}

export function chapterOfLesson(id: string | null | undefined): Chapter | null {
  const lesson = lessonById(id)
  return lesson ? CHAPTER_BY_ID.get(lesson.chapter) ?? null : null
}

export function lessonIndex(id: string): number {
  return LESSON_INDEX.get(id) ?? -1
}

/** Generates a batch of drill words for a lesson id. */
export function generateLessonWords(id: string, count: number): string[] {
  const lesson = lessonById(id) ?? LESSONS[0]
  const out: string[] = []
  let x = Math.floor(Math.random() * 0xffffffff) | 0
  const rng = (): number => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return ((x >>> 0) % 100000) / 100000
  }
  for (let i = 0; i < count; i++) out.push(lesson.drill(rng))
  return out
}

// ── progression: sequential unlock ────────────────────────────────────

/** true when a lesson's saved best meets both targets */
export function isCleared(lesson: Lesson, bests: Bests): boolean {
  const wpm = bests[`lesson:${lesson.id}:wpm`] ?? 0
  const acc = bests[`lesson:${lesson.id}:acc`] ?? 0
  return wpm >= lesson.targetWpm && acc >= lesson.targetAcc
}

/** index of the furthest cleared lesson in the sequence (-1 = none) */
export function furthestClearedIndex(bests: Bests): number {
  for (let i = LESSONS.length - 1; i >= 0; i--) {
    if (isCleared(LESSONS[i], bests)) return i
  }
  return -1
}

/**
 * A lesson is unlocked when it is within one clear of the furthest
 * cleared lesson — enforced linear progression, with forgiveness for
 * lessons that were already attempted.
 */
export function lessonUnlocked(index: number, bests: Bests): boolean {
  if (index <= 0) return true
  const furthest = furthestClearedIndex(bests)
  if (index <= furthest + 1) return true
  const lesson = LESSONS[index]
  return (bests[`lesson:${lesson.id}:wpm`] ?? 0) > 0
}

/** a chapter is unlocked when its first lesson is */
export function chapterUnlocked(chapter: Chapter, bests: Bests): boolean {
  const first = chapter.lessons[0]
  const idx = first ? lessonIndex(first.id) : -1
  return idx < 0 ? true : lessonUnlocked(idx, bests)
}

export function clearedCount(bests: Bests): number {
  return LESSONS.reduce((n, l) => (isCleared(l, bests) ? n + 1 : n), 0)
}
