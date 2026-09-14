import type { Puzzle } from '../types'
import type { ActiveCell, EntryMap } from '../hooks/usePuzzleSolver'

/** Serializable solver state so a puzzle can be resumed later. */
export interface SessionSnapshot {
  entries: EntryMap
  active: ActiveCell | null
  hintsUsed: number
  checkMode: boolean
}

export interface SavedSession {
  puzzle: Puzzle
  snapshot: SessionSnapshot
  savedAt: number
}

const LAST_PUZZLE_KEY = 'vocab-crossword:last-puzzle'

export function loadSavedSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(LAST_PUZZLE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as SavedSession
    if (!saved || !saved.puzzle || !saved.puzzle.words) return null
    return saved
  } catch {
    return null
  }
}

export function saveSavedSession(session: SavedSession): void {
  try {
    localStorage.setItem(LAST_PUZZLE_KEY, JSON.stringify(session))
  } catch {
    // storage full / unavailable — the puzzle stays in memory
  }
}

export function clearSavedSession(): void {
  try {
    localStorage.removeItem(LAST_PUZZLE_KEY)
  } catch {
    // ignore
  }
}