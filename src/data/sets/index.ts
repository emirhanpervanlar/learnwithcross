import type { WordSet } from '../../types'

import oxford3000 from './oxford-3000.json'
import oxford5000 from './oxford-5000.json'
import cambridge3000 from './cambridge-3000.json'
import phrasalVerbs from './phrasal-verbs.json'

export const builtInWordSets: WordSet[] = [
  oxford3000 as WordSet,
  oxford5000 as WordSet,
  cambridge3000 as WordSet,
  phrasalVerbs as WordSet,
]

export function getWordSetById(id: string): WordSet | undefined {
  return builtInWordSets.find(s => s.id === id)
}
