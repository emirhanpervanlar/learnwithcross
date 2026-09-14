import type { Puzzle } from '../types'
import type { EntryMap } from '../hooks/usePuzzleSolver'

export interface PuzzleProgress {
  /** occupied cells that currently hold the correct letter */
  solvedCells: number
  /** total letters across every placed word */
  totalCells: number
  /** number of fully solved words */
  completedWords: number
  totalWords: number
  /** 0..1 fraction of cells solved correctly */
  fraction: number
  /** whole percentage 0..100 */
  percent: number
}

/** Measures how far a puzzle has been solved from its saved letter entries. */
export function computePuzzleProgress(entries: EntryMap, puzzle: Puzzle): PuzzleProgress {
  const expected = new Map<string, string>() // key `${row},${col}` -> expected letter
  let completedWords = 0
  for (const w of puzzle.words) {
    if (w.length === 0) continue
    let all = true
    for (let i = 0; i < w.length; i++) {
      const row = w.row + (w.dir === 'down' ? i : 0)
      const col = w.col + (w.dir === 'across' ? i : 0)
      const key = `${row},${col}`
      if (!expected.has(key)) expected.set(key, w.letters[i])
      if (entries[key] !== w.letters[i]) all = false
    }
    if (all) completedWords++
  }
  let solvedCells = 0
  for (const [key, letter] of expected) {
    if (entries[key] === letter) solvedCells++
  }
  const totalCells = expected.size
  const fraction = totalCells > 0 ? solvedCells / totalCells : puzzle.words.length > 0 ? 0 : 1
  return {
    solvedCells,
    totalCells,
    completedWords,
    totalWords: puzzle.words.length,
    fraction,
    percent: Math.round(fraction * 100),
  }
}