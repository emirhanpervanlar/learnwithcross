import type { Word } from '../../types'
import { normalizeTerm } from './normalize'
import { mulberry32 } from './random'

export type QuestionLanguage = 'tr' | 'en'

/**
 * Deterministically samples `count` words from a set, keeping only terms whose
 * letter length is >= minLength. Falls back to a pseudo-random `Date.now()`
 * seed when none is provided.
 */
export function sampleWords(
  words: Word[],
  count: number,
  minLength: number,
  seed?: number,
): Word[] {
  const rng = mulberry32(seed ?? Date.now())

  const eligible = words.filter(w => normalizeTerm(w.term).length >= minLength)

  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[eligible[i], eligible[j]] = [eligible[j], eligible[i]]
  }

  return eligible.slice(0, Math.max(0, count))
}
