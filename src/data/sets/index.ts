import type { WordSet } from '../../types'

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

export function getWordSetById(id: string): WordSet | undefined {
  return builtInWordSets.find(s => s.id === id)
}
