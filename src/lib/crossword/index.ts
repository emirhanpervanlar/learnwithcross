import type { Difficulty, Puzzle, Word, WordSet } from '../../types'
import { generatePuzzle } from './generator'
import { normalizeTerm } from './normalize'
import { sampleWords } from './sample'
import { lookupSyn, lookupTr } from '../../data/tr'

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
  /** per-word language override, e.g. for half-half story mixes */
  perWordLanguage?: (w: Word, index: number) => 'tr' | 'en'
  showSynonyms?: boolean
}

/** Samples words from a set and generates a puzzle in one step. */
export function buildPuzzle(set: WordSet, options: BuildPuzzleOptions): Puzzle {
  const sampled = sampleWords(set.words, options.wordCount, options.minLength, options.seed)
  const puzzle = generatePuzzle(
    set.id,
    sampled.map((w, i) => {
      const lang = options.perWordLanguage?.(w, i) ?? options.questionLanguage
      let clue = lang === 'tr' ? (lookupTr(normalizeTerm(w.term)) ?? w.definition) : w.definition
      if (options.showSynonyms) {
        const extra: string[] = []
        if (w.pos) extra.push(`(${w.pos})`)
        const syns = lookupSyn(normalizeTerm(w.term))
        if (syns) extra.push(syns)
        if (extra.length > 0) clue = `${clue} · ${extra.join(' ')}`
      }
      return { term: w.term, definition: clue }
    }),
    { seed: options.seed, difficulty: options.difficulty },
  )
  puzzle.questionLanguage = options.questionLanguage ?? 'en'
  puzzle.showSynonyms = options.showSynonyms ?? false
  return puzzle
}
