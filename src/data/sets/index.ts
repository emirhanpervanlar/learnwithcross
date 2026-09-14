import type { LearningMap, Word, WordSet } from '../../types'
import { normalizeTerm } from '../../lib/crossword/normalize'

import oxford3000 from './oxford-3000.json'
import oxford5000 from './oxford-5000.json'
import cambridge3000 from './cambridge-3000.json'
import phrasalVerbs from './phrasal-verbs.json'
import { topicWordSets } from '../topic'

export const WORD_GROUP_LABELS: Record<string, string> = {
  core: 'Genel Kelime',
  digital: 'Dijital Dünya',
  hobbies: 'Hobiler & Kültür',
  academic: 'Akademik & Kariyer',
  daily: 'Günlük Yaşam',
  abstract: 'Soyut & İleri',
}

export const WORD_GROUP_ORDER = ['core', 'digital', 'hobbies', 'academic', 'daily', 'abstract']

const coreSets: WordSet[] = [
  { ...oxford3000, group: 'core' },
  { ...oxford5000, group: 'core' },
  { ...cambridge3000, group: 'core' },
  { ...phrasalVerbs, group: 'core' },
] as WordSet[]

export const builtInWordSets: WordSet[] = [...coreSets, ...topicWordSets]

export const TOPIC_SET_IDS: Set<string> = new Set(topicWordSets.map(s => s.id))

// Runtime-created sets (story stages, review puzzle) register themselves here
// so PuzzleView / SetDetail name lookups keep working.
const extraSets = new Map<string, WordSet>()

export function registerExtraSet(set: WordSet): void {
  extraSets.set(set.id, set)
}

export function getWordSetById(id: string): WordSet | undefined {
  return builtInWordSets.find(s => s.id === id) ?? extraSets.get(id)
}

/**
 * Resolves currently-learned entries back to their real vocabulary words.
 * Used by the review puzzle ("Kelimelerimi Pekiştir") and as the 40% pool
 * of story stages.
 */
export function buildReviewWords(entries: LearningMap, limit = 80): Word[] {
  const byNorm = new Map<string, Word>()
  for (const s of builtInWordSets) {
    for (const w of s.words) {
      const n = normalizeTerm(w.term)
      if (n && !byNorm.has(n)) byNorm.set(n, w)
    }
  }
  const found: { word: Word; priority: number }[] = []
  for (const e of Object.values(entries)) {
    const n = normalizeTerm(e.wordText)
    const w = byNorm.get(n)
    if (w && !found.some(x => x.word === w)) found.push({ word: w, priority: e.score })
  }
  found.sort((a, b) => b.priority - a.priority)
  return found.slice(0, limit).map(x => x.word)
}