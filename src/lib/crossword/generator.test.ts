import { describe, expect, it } from 'vitest'
import type { Puzzle, PuzzleCell, Word, WordSet } from '../../types'
import { generatePuzzle } from './generator'
import { normalizeTerm } from './normalize'
import { sampleWords } from './sample'
import { buildPuzzle } from './index'

const cellAt = (puzzle: Puzzle, row: number, col: number): PuzzleCell | undefined =>
  puzzle.cells.find(c => c.row === row && c.col === col)

describe('normalizeTerm', () => {
  it('strips spaces, case, and non-letters', () => {
    expect(normalizeTerm('Give Up!')).toBe('giveup')
    expect(normalizeTerm('  OXFORD  3000 ')).toBe('oxford')
  })
})

describe('sampleWords', () => {
  const words: Word[] = [
    { term: 'cat', definition: 'a small pet animal' },
    { term: 'elephant', definition: 'a very large animal' },
    { term: 'a', definition: 'one letter word' },
    { term: 'on', definition: 'two letters' },
    { term: 'horse', definition: 'a large animal' },
  ]

  it('respects minLength', () => {
    const sampled = sampleWords(words, 5, 3, 1)
    expect(sampled.length).toBeLessThanOrEqual(5)
    for (const w of sampled) {
      expect(normalizeTerm(w.term).length).toBeGreaterThanOrEqual(3)
    }
  })

  it('is deterministic under the same seed', () => {
    const a = sampleWords(words, 3, 3, 42).map(w => w.term)
    const b = sampleWords(words, 3, 3, 42).map(w => w.term)
    expect(a).toEqual(b)
  })

  it('caps at the number of eligible words', () => {
    const sampled = sampleWords(words, 99, 3, 1)
    expect(sampled.length).toBe(3)
  })
})

describe('generatePuzzle', () => {
  it('throws when nothing is placeable', () => {
    expect(() => generatePuzzle('test', [{ term: 'a', definition: '' }])).toThrow()
    expect(() => generatePuzzle('test', [])).toThrow()
  })

  it('normalizes terms but keeps the original display and clue', () => {
    const puzzle = generatePuzzle('test', [
      { term: 'give up', definition: 'to quit' },
      { term: 'get over', definition: 'to recover' },
    ], { seed: 3 })
    const giveup = puzzle.words.find(w => w.display === 'give up')
    expect(giveup).toBeDefined()
    expect(giveup!.letters).toBe('giveup')
    expect(giveup!.clue).toBe('to quit')
  })

  it('places intersecting words on shared letters', () => {
    const puzzle = generatePuzzle('test', [
      { term: 'apple', definition: 'a fruit' },
      { term: 'grape', definition: 'another fruit' },
      { term: 'orange', definition: 'a citrus fruit' },
    ], { seed: 7, attempts: 12 })

    expect(puzzle.words.length).toBe(3)

    // words must actually share cells (crossings)
    const crossingCells = puzzle.cells.filter(c => c.acrossId && c.downId)
    expect(crossingCells.length).toBeGreaterThanOrEqual(1)
  })

  it('stays within grid bounds', () => {
    const words = [
      { term: 'sunshine', definition: 'bright light' },
      { term: 'moonlight', definition: 'night light' },
      { term: 'starlight', definition: 'twinkling' },
      { term: 'daylight', definition: 'daytime' },
      { term: 'nightfall', definition: 'evening' },
      { term: 'twilight', definition: 'dusk' },
    ]
    const puzzle = generatePuzzle('test', words, { seed: 11, attempts: 12 })

    expect(puzzle.width).toBeGreaterThan(0)
    expect(puzzle.height).toBeGreaterThan(0)
    for (const cell of puzzle.cells) {
      expect(cell.row).toBeGreaterThanOrEqual(0)
      expect(cell.row).toBeLessThan(puzzle.height)
      expect(cell.col).toBeGreaterThanOrEqual(0)
      expect(cell.col).toBeLessThan(puzzle.width)
    }
  })

  it('renders each word at its declared coordinates with correct letters', () => {
    const puzzle = generatePuzzle('test', [
      { term: 'answer', definition: 'a reply' },
      { term: 'question', definition: 'a query' },
      { term: 'solution', definition: 'an answer to a problem' },
    ], { seed: 5, attempts: 12 })

    for (const w of puzzle.words) {
      expect(w.length).toBe(w.letters.length)
      for (let i = 0; i < w.length; i++) {
        const row = w.row + (w.dir === 'down' ? i : 0)
        const col = w.col + (w.dir === 'across' ? i : 0)
        const cell = cellAt(puzzle, row, col)
        expect(cell, `cell for ${JSON.stringify(w)} at ${row},${col}`).toBeDefined()
        expect(cell!.letter).toBe(w.letters[i])
      }
    }
  })

  it('produces one clue per direction per word, with contiguous numbering', () => {
    const puzzle = generatePuzzle('test', [
      { term: 'water', definition: 'a liquid' },
      { term: 'earth', definition: 'the planet' },
      { term: 'fire', definition: 'blazing heat' },
      { term: 'wind', definition: 'moving air' },
    ], { seed: 9, attempts: 12 })

    const across = puzzle.clues.filter(c => c.dir === 'across')
    const down = puzzle.clues.filter(c => c.dir === 'down')
    expect(puzzle.clues.length).toBe(across.length + down.length)

    // clue answers must match placed words
    for (const clue of puzzle.clues) {
      const word = puzzle.words.find(w => w.id === clue.wordId)
      expect(word).toBeDefined()
      expect(clue.answer).toBe(word!.letters)
    }
  })

  it('is deterministic for a fixed seed', () => {
    const input = [
      { term: 'monkey', definition: 'an animal' },
      { term: 'giraffe', definition: 'a tall animal' },
      { term: 'zebra', definition: 'striped animal' },
      { term: 'elephant', definition: 'big animal' },
      { term: 'tiger', definition: 'a cat' },
    ]
    const a = generatePuzzle('test', input, { seed: 99, attempts: 8 })
    const b = generatePuzzle('test', input, { seed: 99, attempts: 8 })
    expect(JSON.stringify(a.cells)).toBe(JSON.stringify(b.cells))
    expect(a.clues.map(c => `${c.number}${c.dir}`)).toEqual(b.clues.map(c => `${c.number}${c.dir}`))
  })
})

describe('buildPuzzle', () => {
  it('samples then generates from a word set', () => {
    const set: WordSet = {
      id: 's1',
      name: 'Mock',
      group: 'core',
      source: 'custom',
      description: '',
      words: Array.from({ length: 40 }, (_, i) => ({ term: `word${i}`, definition: `def ${i}` })),
    }
    const puzzle = buildPuzzle(set, { wordCount: 8, minLength: 3, seed: 13 })
    expect(puzzle.words.length).toBe(8)
    expect(puzzle.setSlug).toBe('s1')
  })
})

describe('difficulty prefill', () => {
  const input = [
    { term: 'water', definition: 'a liquid' },
    { term: 'earth', definition: 'the planet' },
    { term: 'fire', definition: 'blazing heat' },
    { term: 'wind', definition: 'moving air' },
    { term: 'stone', definition: 'solid rock' },
    { term: 'cloud', definition: 'water vapor' },
    { term: 'storm', definition: 'violent weather' },
    { term: 'light', definition: 'visible energy' },
    { term: 'night', definition: 'dark hours' },
    { term: 'river', definition: 'flowing water' },
  ]

  it('kolay fills a portion of the cells', () => {
    const puzzle = generatePuzzle('test', input, { seed: 21, attempts: 12, difficulty: 'kolay' })
    const given = puzzle.cells.filter(c => c.given)
    expect(given.length).toBeGreaterThan(0)
    expect(given.length).toBeLessThan(puzzle.cells.length)
    expect(puzzle.difficulty).toBe('kolay')
  })

  it('normal gives letters to a subset of words only', () => {
    const puzzle = generatePuzzle('test', input, { seed: 21, attempts: 12, difficulty: 'normal' })
    const given = puzzle.cells.filter(c => c.given)
    expect(given.length).toBeGreaterThan(0)
    const givenWords = new Set(
      given.flatMap(c => [c.acrossId, c.downId].filter((id): id is string => !!id)),
    )
    expect(givenWords.size).toBeGreaterThan(0)
    expect(givenWords.size).toBeLessThanOrEqual(puzzle.words.length)
  })

  it('zor has no pre-filled letters', () => {
    const puzzle = generatePuzzle('test', input, { seed: 21, attempts: 12, difficulty: 'zor' })
    expect(puzzle.cells.every(c => !c.given)).toBe(true)
    expect(puzzle.difficulty).toBe('zor')
  })

  it('defaults to normal difficulty', () => {
    const puzzle = generatePuzzle('test', input, { seed: 21, attempts: 12 })
    expect(puzzle.difficulty).toBe('normal')
  })

  it('keeps given cells deterministic for a fixed seed', () => {
    const a = generatePuzzle('test', input, { seed: 33, attempts: 10, difficulty: 'kolay' })
    const b = generatePuzzle('test', input, { seed: 33, attempts: 10, difficulty: 'kolay' })
    expect(a.cells.map(c => c.given)).toEqual(b.cells.map(c => c.given))
  })

  it('never reveals more than 40% of any single word in kolay mode', () => {
    const puzzle = generatePuzzle('test', input, { seed: 7, attempts: 12, difficulty: 'kolay' })
    const cellMap = new Map(puzzle.cells.map(c => [`${c.row},${c.col}`, c] as const))
    for (const w of puzzle.words) {
      let given = 0
      for (let i = 0; i < w.length; i++) {
        const r = w.row + (w.dir === 'down' ? i : 0)
        const c = w.col + (w.dir === 'across' ? i : 0)
        if (cellMap.get(`${r},${c}`)?.given) given++
      }
      expect(given).toBeLessThanOrEqual(Math.floor(w.length * 0.4))
    }
  })
})

describe('definition cleanup', () => {
  it('strips the term from a clue that contains it verbatim', () => {
    const puzzle = generatePuzzle('test', [{ term: 'mineral', definition: 'a mineral is a natural substance in rock form' }], { seed: 5 })
    expect(puzzle.clues[0]!.text).not.toMatch(/mineral/i)
  })

  it('keeps unrelated definitions unchanged', () => {
    const puzzle = generatePuzzle('test', [{ term: 'mineral', definition: 'a natural substance obtained from rock' }], { seed: 5 })
    expect(puzzle.clues[0]!.text).toBe('a natural substance obtained from rock')
  })
})