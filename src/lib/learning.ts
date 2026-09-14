import type { LearningEntry, LearningMap, PlacedWord } from '../types'

const LEARNING_KEY = 'vocab-crossword:learning'

export function loadLearning(): LearningMap {
  try {
    const raw = localStorage.getItem(LEARNING_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as LearningMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveLearning(map: LearningMap): void {
  try {
    localStorage.setItem(LEARNING_KEY, JSON.stringify(map))
  } catch {
    // ignore storage failures
  }
}

export const learningKeyFor = (word: PlacedWord, setSlug: string): string =>
  `${setSlug}::${word.id}`

interface ScoreDeltas {
  score: number
  completed?: boolean
}

function applyDeltas(
  map: LearningMap,
  word: PlacedWord,
  setSlug: string,
  setName: string,
  deltas: ScoreDeltas,
): LearningMap {
  const key = learningKeyFor(word, setSlug)
  const prev = map[key]
  const entry: LearningEntry = prev ?? {
    wordId: key,
    wordText: word.display,
    setSlug,
    setName,
    score: 0,
    completedCount: 0,
    lastWorkedAt: 0,
  }
  const nextEntry: LearningEntry = {
    ...entry,
    score: entry.score + deltas.score,
    completedCount: deltas.completed
      ? entry.completedCount + 1
      : entry.completedCount,
    lastWorkedAt: Date.now(),
  }
  return { ...map, [key]: nextEntry }
}

/** +1 point each time a letter is typed into the word. */
export function recordWorked(
  map: LearningMap,
  word: PlacedWord,
  setSlug: string,
  setName: string,
): LearningMap {
  return applyDeltas(map, word, setSlug, setName, { score: 1 })
}

/** +2 bonus when a newly correct letter is filled. */
export function recordCorrect(
  map: LearningMap,
  word: PlacedWord,
  setSlug: string,
  setName: string,
): LearningMap {
  return applyDeltas(map, word, setSlug, setName, { score: 2 })
}

/** +10 bonus when the whole word is completed. */
export function recordCompleted(
  map: LearningMap,
  word: PlacedWord,
  setSlug: string,
  setName: string,
): LearningMap {
  return applyDeltas(map, word, setSlug, setName, { score: 10, completed: true })
}

interface LevelThreshold {
  min: number
  name: string
}

const LEVELS: LevelThreshold[] = [
  { min: 0, name: 'Başlangıç' },
  { min: 5, name: 'Gelişiyor' },
  { min: 15, name: 'İyi' },
  { min: 30, name: 'Çok İyi' },
  { min: 50, name: 'Usta' },
]

export interface LearningLevel {
  /** 1-based level number */
  number: number
  name: string
  /** score needed for the next level, or null when at max */
  nextAt: number | null
  /** 0..1 progress toward the next level */
  progress: number
}

/** Derives the mastery level (and next threshold) from a score. */
export function levelFor(score: number): LearningLevel {
  let idx = 0
  for (let i = 0; i < LEVELS.length; i++) {
    if (score >= LEVELS[i].min) idx = i
  }
  const current = LEVELS[idx]
  const next = LEVELS[idx + 1]
  const progress = next ? (score - current.min) / (next.min - current.min) : 1
  return {
    number: idx + 1,
    name: current.name,
    nextAt: next?.min ?? null,
    progress: Math.min(1, Math.max(0, progress)),
  }
}