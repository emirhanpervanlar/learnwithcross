export type WordSetSource = 'oxford' | 'cambridge' | 'custom' | 'topic'

export type Difficulty = 'kolay' | 'normal' | 'zor'

export interface Word {
  /** the English term, e.g. "ephemeral" */
  term: string
  /** the clue / definition shown in puzzles */
  definition: string
  /** optional usage example */
  example?: string
  /** part of speech, e.g. "noun" | "verb" | "adjective" */
  pos?: string
  /** optional CEFR level, e.g. "B1" */
  level?: string
}

export interface WordSet {
  id: string
  name: string
  /** logical category used to group sets in the catalog, e.g. "digital" */
  group: string
  source: WordSetSource
  /** optional target level, e.g. "A1-A2" */
  level?: string
  description: string
  words: Word[]
}

export type Direction = 'across' | 'down'

export interface PuzzleCell {
  row: number
  col: number
  /** single lowercase letter */
  letter: string
  /** true when the letter is pre-filled by the generator (difficulty) */
  given: boolean
  /** clue number, only set on word-start cells */
  number?: number
  /** id of the across word passing through this cell, if any */
  acrossId?: string
  /** id of the down word passing through this cell, if any */
  downId?: string
}

export interface PlacedWord {
  id: string
  /** letters only, e.g. "giveup" */
  letters: string
  /** original term, e.g. "give up" */
  display: string
  /** the definition used as the clue */
  clue: string
  /** grid coordinates of the first letter */
  row: number
  col: number
  dir: Direction
  length: number
}

export interface PuzzleClue {
  id: string
  number: number
  dir: Direction
  text: string
  /** normalized letters, for answer verification */
  answer: string
  wordId: string
}

export interface Puzzle {
  id: string
  /** the id of the WordSet this puzzle was generated from */
  setSlug: string
  /** the difficulty this puzzle was generated for */
  difficulty: Difficulty
  /** letter cells only ('' block cells are implicit) */
  cells: PuzzleCell[]
  words: PlacedWord[]
  clues: PuzzleClue[]
  width: number
  height: number
  questionLanguage?: 'tr' | 'en'
  showSynonyms?: boolean
}

export interface LearningEntry {
  /** stable per word across puzzles: `${setSlug}::${wordId}` */
  wordId: string
  /** the display term, e.g. "give up" */
  wordText: string
  setSlug: string
  setName: string
  /** cumulative learning points */
  score: number
  /** how many times the word has been fully solved */
  completedCount: number
  lastWorkedAt: number
}

export type LearningMap = Record<string, LearningEntry>