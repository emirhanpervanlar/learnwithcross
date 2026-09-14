import type { Difficulty, Direction, PlacedWord, Puzzle, PuzzleCell, PuzzleClue } from '../../types'
import { normalizeTerm } from './normalize'
import { makeId, mulberry32 } from './random'
import { DIFFICULTY_CONFIG } from '../difficulty'

export interface PuzzleWordInput {
  term: string
  definition: string
}

export interface GenerateOptions {
  seed?: number
  /** aborts a failed grow attempt once any bound exceeds this */
  maxGridSize?: number
  /** number of random word-orderings to try (best outcome is kept) */
  attempts?: number
  /** difficulty controls pre-filled letters (defaults to "normal") */
  difficulty?: Difficulty
}

interface RenderedWord {
  id: string
  letters: string
  display: string
  clue: string
}

interface Placed extends RenderedWord {
  row: number
  col: number
  dir: Direction
  intersections: number
}

interface CellEntry {
  letter: string
  dir: Direction
}

interface Bounds {
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
}

interface BuildResult {
  grid: Map<string, CellEntry>
  placed: Placed[]
  bounds: Bounds
  intersections: number
}

const DIR_VEC: Record<Direction, readonly [number, number]> = {
  across: [0, 1],
  down: [1, 0],
}

const ORTHO_VEC: Record<Direction, readonly [number, number]> = {
  across: [1, 0], // above/below
  down: [0, 1], // left/right
}

const key = (row: number, col: number) => `${row},${col}`

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function updateBounds(bounds: Bounds, row: number, col: number) {
  if (row < bounds.minRow) bounds.minRow = row
  if (row > bounds.maxRow) bounds.maxRow = row
  if (col < bounds.minCol) bounds.minCol = col
  if (col > bounds.maxCol) bounds.maxCol = col
}

function countBounds(b: Bounds): number {
  return (b.maxRow - b.minRow + 1) * (b.maxCol - b.minCol + 1)
}

/**
 * Checks whether `letters` can be placed so that `row,col` is its start cell,
 * running in `dir`. A placement must:
 *  - only overlap cells with identical letters (>= 1 crossing),
 *  - never run parallel to an existing word,
 *  - have empty entrance/exit cells,
 *  - have empty perpendicular flanking neighbours for non-crossing cells.
 */
function canPlace(grid: Map<string, CellEntry>, letters: string, row: number, col: number, dir: Direction): boolean {
  const [dr, dc] = DIR_VEC[dir]
  const [or2, oc] = ORTHO_VEC[dir]

  if (grid.has(key(row - dr, col - dc))) return false
  if (grid.has(key(row + dr * letters.length, col + dc * letters.length))) return false

  let intersects = false
  for (let i = 0; i < letters.length; i++) {
    const r = row + dr * i
    const c = col + dc * i
    const existing = grid.get(key(r, c))
    if (existing) {
      if (existing.letter !== letters[i]) return false
      if (existing.dir === dir) return false
      intersects = true
    } else {
      if (grid.has(key(r + or2, c + oc))) return false
      if (grid.has(key(r - or2, c - oc))) return false
    }
  }
  return intersects
}

function countIntersections(grid: Map<string, CellEntry>, letters: string, row: number, col: number, dir: Direction): number {
  const [dr, dc] = DIR_VEC[dir]
  let n = 0
  for (let i = 0; i < letters.length; i++) {
    if (grid.has(key(row + dr * i, col + dc * i))) n++
  }
  return n
}

function findPlacements(grid: Map<string, CellEntry>, word: RenderedWord): { row: number; col: number; dir: Direction; intersections: number }[] {
  const found = new Map<string, { row: number; col: number; dir: Direction; intersections: number }>()

  for (const [k, cell] of grid) {
    const [r, c] = k.split(',').map(Number)
    for (let i = 0; i < word.letters.length; i++) {
      if (cell.letter !== word.letters[i]) continue
      for (const dir of ['across', 'down'] as const) {
        if (cell.dir === dir) continue // must cross, not run parallel
        const [dr, dc] = DIR_VEC[dir]
        const sRow = r - dr * i
        const sCol = c - dc * i
        if (!canPlace(grid, word.letters, sRow, sCol, dir)) continue
        found.set(key(sRow, sCol) + dir, {
          row: sRow,
          col: sCol,
          dir,
          intersections: countIntersections(grid, word.letters, sRow, sCol, dir),
        })
      }
    }
  }
  return [...found.values()]
}

function pickBest(
  placements: { row: number; col: number; dir: Direction; intersections: number }[],
  bounds: Bounds,
  letters: string,
): { row: number; col: number; dir: Direction } {
  const prevArea = countBounds(bounds)
  let best: { row: number; col: number; dir: Direction; score: number } | null = null

  for (const p of placements) {
    const [dr, dc] = DIR_VEC[p.dir]
    const nb: Bounds = { ...bounds }
    for (let i = 0; i < letters.length; i++) updateBounds(nb, p.row + dr * i, p.col + dc * i)

    // prefer more crossings, then compact growth, then closeness to origin
    const score = p.intersections * 10000 - (countBounds(nb) - prevArea) - Math.abs(p.row) * 10 - Math.abs(p.col) * 5
    if (!best || score > best.score) best = { row: p.row, col: p.col, dir: p.dir, score }
  }

  return { row: best!.row, col: best!.col, dir: best!.dir }
}

function placeWord(
  grid: Map<string, CellEntry>,
  word: RenderedWord,
  row: number,
  col: number,
  dir: Direction,
  bounds: Bounds,
): number {
  const [dr, dc] = DIR_VEC[dir]
  let intersections = 0
  for (let i = 0; i < word.letters.length; i++) {
    const r = row + dr * i
    const c = col + dc * i
    const k = key(r, c)
    if (grid.has(k)) intersections++
    grid.set(k, { letter: word.letters[i], dir })
    updateBounds(bounds, r, c)
  }
  return intersections
}

function build(ordered: RenderedWord[], maxGridSize: number): BuildResult | null {
  const grid = new Map<string, CellEntry>()
  const bounds: Bounds = { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 }
  const placed: Placed[] = []
  let intersections = 0

  const first = ordered[0]
  const firstDir: Direction = 'across'
  const startRow = 0
  const startCol = -Math.floor(first.letters.length / 2)
  placeWord(grid, first, startRow, startCol, firstDir, bounds)
  placed.push({ ...first, row: startRow, col: startCol, dir: firstDir, intersections: 0 })

  for (const word of ordered.slice(1)) {
    const candidates = findPlacements(grid, word)
    if (candidates.length > 0) {
      const p = pickBest(candidates, bounds, word.letters)
      const ins = placeWord(grid, word, p.row, p.col, p.dir, bounds)
      intersections += ins
      placed.push({ ...word, row: p.row, col: p.col, dir: p.dir, intersections: ins })
    } else {
      // isolated fallback: a fresh row below the current content
      const row = bounds.maxRow + 2
      const col = -Math.floor(word.letters.length / 2)
      placeWord(grid, word, row, col, 'across', bounds)
      placed.push({ ...word, row, col, dir: 'across', intersections: 0 })
    }

    if (
      bounds.maxRow - bounds.minRow + 1 > maxGridSize ||
      bounds.maxCol - bounds.minCol + 1 > maxGridSize
    ) {
      return null
    }
  }

  return { grid, placed, bounds, intersections }
}

function assemble(result: BuildResult, setSlug: string, difficulty: Difficulty): Puzzle {
  const { placed, bounds } = result
  const width = bounds.maxCol - bounds.minCol + 1
  const height = bounds.maxRow - bounds.minRow + 1

  const words: PlacedWord[] = placed.map(p => ({
    id: p.id,
    letters: p.letters,
    display: p.display,
    clue: p.clue,
    row: p.row - bounds.minRow,
    col: p.col - bounds.minCol,
    dir: p.dir,
    length: p.letters.length,
  }))

  const cells = new Map<string, PuzzleCell>()
  const starts = new Map<string, { across?: PlacedWord; down?: PlacedWord }>()

  for (const w of words) {
    const [dr, dc] = DIR_VEC[w.dir]
    for (let i = 0; i < w.length; i++) {
      const row = w.row + dr * i
      const col = w.col + dc * i
      const k = key(row, col)
      let cell = cells.get(k)
      if (!cell) {
        cell = { row, col, letter: w.letters[i], given: false }
        cells.set(k, cell)
      }
      if (w.dir === 'across') cell.acrossId = w.id
      else cell.downId = w.id
    }

    const sk = key(w.row, w.col)
    const entry = starts.get(sk) ?? {}
    if (w.dir === 'across') entry.across = w
    else entry.down = w
    starts.set(sk, entry)
  }

  // Number clue starts in row-major order; a cell starting both directions shares a number.
  const clueStarts = [...starts.keys()]
    .map(k => k.split(',').map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])

  const clues: PuzzleClue[] = []
  let number = 1
  for (const [r, c] of clueStarts) {
    const sk = key(r, c)
    const entry = starts.get(sk)!
    const startCell = cells.get(sk)!
    startCell.number = number

    for (const dir of ['across', 'down'] as const) {
      const w = entry[dir]
      if (!w) continue
      clues.push({
        id: `${number}-${dir}`,
        number,
        dir,
        text: w.clue,
        answer: w.letters,
        wordId: w.id,
      })
    }
    number++
  }

  clues.sort((a, b) => {
    const order = (d: Direction) => (d === 'across' ? 0 : 1)
    return a.number - b.number || order(a.dir) - order(b.dir)
  })

  return {
    id: makeId('puzzle'),
    setSlug,
    difficulty,
    cells: [...cells.values()].sort((a, b) => a.row - b.row || a.col - b.col),
    words,
    clues,
    width,
    height,
  }
}

/**
 * Marks `given` letters according to the difficulty:
 *  - kolay: fills `amount` of all occupied cells,
 *  - normal: gives one letter to `amount` of the words,
 *  - zor: nothing.
 */
function applyPrefill(puzzle: Puzzle, rng: () => number): void {
  const cfg = DIFFICULTY_CONFIG[puzzle.difficulty]
  const cellsByKey = new Map(puzzle.cells.map(c => [key(c.row, c.col), c] as const))

  if (cfg.prefill === 'cellPercent') {
    const cells = shuffle(puzzle.cells, rng)
    const target = Math.round(cells.length * cfg.prefillAmount)
    for (let i = 0; i < Math.min(target, cells.length); i++) cells[i].given = true
    return
  }

  if (cfg.prefill === 'wordTargeted') {
    const count = Math.max(1, Math.round(puzzle.words.length * cfg.prefillAmount))
    const words = shuffle(puzzle.words, rng).slice(0, count)
    for (const w of words) {
      const pool: PuzzleCell[] = []
      for (let i = 0; i < w.length; i++) {
        const r = w.row + (w.dir === 'down' ? i : 0)
        const c = w.col + (w.dir === 'across' ? i : 0)
        const cell = cellsByKey.get(key(r, c))
        if (cell && !cell.given) pool.push(cell)
      }
      if (pool.length > 0) shuffle(pool, rng)[0].given = true
    }
  }
}

/**
 * Generates a crossword from a list of words. The words are placed on a
 * growing grid using a greedy branch-and-bound style heuristic; several
 * random orderings are tried and the most compact, intersection-rich result
 * wins. Pure function — no DOM/IO, unit-testable.
 */
export function generatePuzzle(
  setSlug: string,
  input: PuzzleWordInput[],
  options: GenerateOptions = {},
): Puzzle {
  const maxGridSize = options.maxGridSize ?? 60
  const attempts = options.attempts ?? 6
  const difficulty = options.difficulty ?? 'normal'
  const rng = mulberry32(options.seed ?? Date.now())

  const words: RenderedWord[] = []
  for (let i = 0; i < input.length; i++) {
    const letters = normalizeTerm(input[i].term)
    if (letters.length < 2) continue
    words.push({ id: `w${i}`, letters, display: input[i].term, clue: input[i].definition })
  }

  if (words.length === 0) throw new Error('generatePuzzle: no placeable words')

  let best: BuildResult | null = null
  let bestScore = -Infinity
  let last: BuildResult | null = null

  for (let attempt = 0; attempt < attempts; attempt++) {
    const ordered = attempt === 0 ? words : shuffle(words, rng)
    const result = build(ordered, maxGridSize)
    if (!result) continue
    last = result
    const score = result.intersections * 1000 - countBounds(result.bounds)
    if (score > bestScore) {
      bestScore = score
      best = result
    }
  }

  const puzzle = assemble(best ?? last!, setSlug, difficulty)
  applyPrefill(puzzle, rng)
  return puzzle
}