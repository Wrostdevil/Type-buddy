import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import { lessonById } from './lessons'
import type { LessonId } from './lessons'
import type { TestConfig, TestResult } from './engine'

interface GhostDB extends DBSchema {
  results: {
    key: number
    value: TestResult
    indexes: { 'by-date': number }
  }
}

const DB_NAME = 'ghost-terminal'
const DB_VERSION = 1
const SETTINGS_KEY = 'ghost-terminal:settings'

let dbPromise: Promise<IDBPDatabase<GhostDB>> | null = null

function getDB(): Promise<IDBPDatabase<GhostDB>> {
  if (!dbPromise) {
    dbPromise = openDB<GhostDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('results')) {
          db.createObjectStore('results', {
            keyPath: 'id',
            autoIncrement: true,
          }).createIndex('by-date', 'date')
        }
      },
    })
  }
  return dbPromise
}

/** Saves a finished test result and returns it with its assigned id. */
export async function saveResult(result: TestResult): Promise<TestResult> {
  const db = await getDB()
  const id = await db.add('results', result)
  return { ...result, id: Number(id) }
}

/** Loads every saved result, newest first. */
export async function loadResults(): Promise<TestResult[]> {
  try {
    const db = await getDB()
    const all = await db.getAllFromIndex('results', 'by-date')
    return all.reverse()
  } catch (error) {
    console.error('failed to load results', error)
    return []
  }
}

/** Deletes every saved result. */
export async function clearResults(): Promise<void> {
  const db = await getDB()
  await db.clear('results')
}

export function loadSettings(): TestConfig | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<TestConfig>
    if (value.mode !== 'time' && value.mode !== 'words') return null
    const timeLimit = Number(value.timeLimit)
    const wordCount = Number(value.wordCount)
    const lesson: LessonId | null =
      value.lesson && lessonById(value.lesson) ? value.lesson : null
    return {
      mode: value.mode,
      timeLimit: timeLimit > 0 ? timeLimit : 30,
      wordCount: wordCount > 0 ? wordCount : 25,
      punctuation: Boolean(value.punctuation),
      numbers: Boolean(value.numbers),
      lesson,
    }
  } catch {
    return null
  }
}

export function saveSettings(config: TestConfig): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(config))
  } catch {
    // storage unavailable (private mode etc.) — settings simply won't persist
  }
}

const SOUND_KEY = 'ghost-terminal:sound'

/** Sound is on by default. */
export function loadSoundSetting(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function saveSoundSetting(enabled: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off')
  } catch {
    // storage unavailable (private mode etc.) — settings simply won't persist
  }
}
