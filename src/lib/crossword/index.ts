import type { Difficulty, Puzzle, WordSet } from '../../types'
import { generatePuzzle } from './generator'
import { sampleWords } from './sample'

export { generatePuzzle } from './generator'
export { normalizeTerm } from './normalize'
export { sampleWords } from './sample'
export type { GenerateOptions, PuzzleWordInput } from './generator'

export interface BuildPuzzleOptions {
  wordCount: number
  minLength: number
  seed?: number
  difficulty?: Difficulty
}

/** Samples words from a set and generates a puzzle in one step. */
export function buildPuzzle(set: WordSet, options: BuildPuzzleOptions): Puzzle {
  const sampled = sampleWords(set.words, options.wordCount, options.minLength, options.seed)
  return generatePuzzle(
    set.id,
    sampled.map(w => ({ term: w.term, definition: w.definition })),
    { seed: options.seed, difficulty: options.difficulty },
  )
}