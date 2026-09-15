import type { Difficulty, Puzzle, WordSet } from '../../types'
import { generatePuzzle } from './generator'
import { sampleWords } from './sample'

export { generatePuzzle } from './generator'
export { latinize, normalizeTerm } from './normalize'
export { sampleWords } from './sample'
export type { GenerateOptions, PuzzleWordInput } from './generator'

export interface BuildPuzzleOptions {
  wordCount: number
  minLength: number
  seed?: number
  difficulty?: Difficulty
  questionLanguage?: 'tr' | 'en'
  showSynonyms?: boolean
}

/** Samples words from a set and generates a puzzle in one step. */
export function buildPuzzle(set: WordSet, options: BuildPuzzleOptions): Puzzle {
  const sampled = sampleWords(set.words, options.wordCount, options.minLength, options.seed)
  const puzzle = generatePuzzle(
    set.id,
    sampled.map(w => {
      let clue = w.definition
      if (options.showSynonyms) {
        const extra: string[] = []
        if (w.pos) extra.push(`(${w.pos})`)
        if (w.example) extra.push(`örnek: ${w.example}`)
        if (extra.length > 0) clue = `${clue} · ${extra.join(' ')}`
      }
      return { term: w.term, definition: clue }
    }),
    { seed: options.seed, difficulty: options.difficulty },
  )
  puzzle.questionLanguage = options.questionLanguage ?? 'tr'
  puzzle.showSynonyms = options.showSynonyms ?? false
  return puzzle
}
