import { describe, expect, it } from 'vitest'
import type { Puzzle } from '../types'
import { computePuzzleProgress } from './progress'

const puzzle: Puzzle = {
  id: 'p1',
  setSlug: 's1',
  difficulty: 'normal',
  cells: [],
  words: [
    { id: 'w0', letters: 'cat', display: 'cat', clue: 'a pet', row: 0, col: 0, dir: 'across', length: 3 },
    { id: 'w1', letters: 'cow', display: 'cow', clue: 'a farm animal', row: 0, col: 0, dir: 'down', length: 3 },
  ],
  clues: [],
  width: 3,
  height: 3,
}

describe('computePuzzleProgress', () => {
  it('reports 0% with empty entries', () => {
    const p = computePuzzleProgress({}, puzzle)
    expect(p.totalCells).toBe(5)
    expect(p.solvedCells).toBe(0)
    expect(p.completedWords).toBe(0)
    expect(p.fraction).toBe(0)
    expect(p.percent).toBe(0)
  })

  it('counts only correct letters', () => {
    const p = computePuzzleProgress({ '0,0': 'x' }, puzzle)
    expect(p.solvedCells).toBe(0)
    expect(p.percent).toBe(0)
  })

  it('reports partial progress', () => {
    const entries = { '0,0': 'c', '0,1': 'a' }
    const p = computePuzzleProgress(entries, puzzle)
    expect(p.solvedCells).toBe(2)
    expect(p.fraction).toBeCloseTo(2 / 5, 5)
    expect(p.completedWords).toBe(0)
  })

  it('detects fully completed words', () => {
    const entries = {
      '0,0': 'c',
      '0,1': 'a',
      '0,2': 't',
      '1,0': 'o',
      '2,0': 'w',
    }
    const p = computePuzzleProgress(entries, puzzle)
    expect(p.completedWords).toBe(2)
    expect(p.fraction).toBe(1)
  })

  it('only counts letters present in entries (given cells must be passed too)', () => {
    const withGiven: Puzzle = {
      ...puzzle,
      cells: [{ row: 0, col: 1, letter: 'a', given: true }],
    }
    // given letters live in words, so an empty entry map should still count them
    const p = computePuzzleProgress({}, withGiven)
    expect(p.solvedCells).toBe(0)
  })
})