import type { Word } from '../types'
import { mulberry32 } from './crossword/random'
import { normalizeTerm } from './crossword/normalize'
import { lookupTr } from '../data/tr'

export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'

export const CEFR_ORDER: Cefr[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export interface StoryChapter {
  cefr: Cefr
  label: string
  start: number
  end: number
}

export const STORY_STAGES = 100

export const STORY_CHAPTERS: StoryChapter[] = [
  { cefr: 'A1', label: 'Başlangıç', start: 1, end: 15 },
  { cefr: 'A2', label: 'Temel', start: 16, end: 30 },
  { cefr: 'B1', label: 'Orta — 1', start: 31, end: 48 },
  { cefr: 'B2', label: 'Orta — 2', start: 49, end: 66 },
  { cefr: 'C1', label: 'İleri — 1', start: 67, end: 84 },
  { cefr: 'C2', label: 'İleri — 2', start: 85, end: 100 },
]

export function chapterForStage(stage: number): StoryChapter {
  const s = Math.min(STORY_STAGES, Math.max(1, Math.floor(stage)))
  return STORY_CHAPTERS.find(c => s >= c.start && s <= c.end) ?? STORY_CHAPTERS[0]
}

/** First stage of the chapter that covers `cefr`. */
export function startStageFor(cefr: Cefr | string): number {
  const c = STORY_CHAPTERS.find(x => x.cefr === cefr)
  return c ? c.start : 1
}

/** The stage a player should play next, given how many they cleared. */
export function nextStageFor(cleared: number): number {
  return Math.min(STORY_STAGES, Math.max(0, Math.floor(cleared)) + 1)
}

/** Recommended starting chapter for a fresh player based on player level. */
export function recommendedStartStage(playerLevel: number): number {
  if (playerLevel >= 20) return startStageFor('C2')
  if (playerLevel >= 15) return startStageFor('C1')
  if (playerLevel >= 10) return startStageFor('B2')
  if (playerLevel >= 5) return startStageFor('B1')
  if (playerLevel >= 2) return startStageFor('A2')
  return startStageFor('A1')
}

export interface StageConfig {
  stage: number
  chapter: StoryChapter
  difficulty: 'kolay' | 'normal' | 'zor'
  wordCount: number
  minLength: number
}

export function stageConfig(stage: number): StageConfig {
  const chapter = chapterForStage(stage)
  const len = chapter.end - chapter.start + 1
  const idx = Math.max(0, stage - chapter.start)
  const third = idx / len
  const difficulty = third < 1 / 3 ? 'kolay' : third < 2 / 3 ? 'normal' : 'zor'
  const wordCount = Math.min(20, 6 + Math.floor(stage / 8))
  const minLength = stage <= 30 ? 3 : stage <= 66 ? 4 : 5
  return { stage, chapter, difficulty, wordCount, minLength }
}

export type StoryLanguageMode = 'tr' | 'mixed' | 'en'

/**
 * Story question-language policy:
 *  - A1 and A2: questions come in Turkish,
 *  - last third of A2: half Turkish half English,
 *  - B1 and above: all English.
 */
export function storyLanguageForStage(stage: number): StoryLanguageMode {
  const chapter = chapterForStage(stage)
  if (chapter.cefr === 'A1') return 'tr'
  if (chapter.cefr === 'A2') {
    const len = chapter.end - chapter.start + 1
    const frac = (stage - chapter.start) / len
    return frac >= 2 / 3 ? 'mixed' : 'tr'
  }
  return 'en'
}

/** Keeps only words that actually have a Turkish gloss (used for TR story stages). */
export function filterTranslatedWords(words: Word[]): Word[] {
  return words.filter(w => lookupTr(normalizeTerm(w.term)) != null)
}

export function filterTranslatedPools(pools: CefrPools): CefrPools {
  return {
    A1: filterTranslatedWords(pools.A1),
    A2: filterTranslatedWords(pools.A2),
    B1: filterTranslatedWords(pools.B1),
    B2: filterTranslatedWords(pools.B2),
    C1: filterTranslatedWords(pools.C1),
    C2: filterTranslatedWords(pools.C2),
  }
}

export type CefrPools = Record<Cefr, Word[]>

/** Groups words by their CEFR level, dropping duplicates and level-less words. */
export function buildCefrPools(words: Word[]): CefrPools {
  const pools: CefrPools = { A1: [], A2: [], B1: [], B2: [], C1: [], C2: [] }
  const seen = new Set<string>()
  for (const w of words) {
    const lv = w.level?.trim().toUpperCase()
    if (!lv) continue
    const key = lv as Cefr
    if (!CEFR_ORDER.includes(key)) continue
    const n = normalizeTerm(w.term)
    if (!n) continue
    if (seen.has(`${key}::${n}`)) continue
    seen.add(`${key}::${n}`)
    pools[key].push(w)
  }
  return pools
}

export interface StoryRecipe {
  stage: number
  chapter: StoryChapter
  difficulty: 'kolay' | 'normal' | 'zor'
  words: Word[]
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed)
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Builds the word list for one story stage using the 40/50/10 recipe:
 *  - 40%: already-learned words (reinforcement),
 *  - 50%: words of the current CEFR chapter,
 *  - 10%: a peek at the next CEFR chapter (the leftover budget returns
 *         to the current chapter when there is no next one, and a generic
 *         fallback tops the stage up from any pool when the chapter pool
 *         runs dry).
 */
export function buildStageWords(options: {
  stage: number
  pools: CefrPools
  reviewWords: Word[]
}): StoryRecipe {
  const cfg = stageConfig(options.stage)
  const current = cfg.chapter.cefr
  const curIdx = CEFR_ORDER.indexOf(current)
  const next = curIdx >= 0 && curIdx < CEFR_ORDER.length - 1 ? CEFR_ORDER[curIdx + 1] : null

  const reviewN = options.reviewWords.length === 0 ? 0 : Math.round(cfg.wordCount * 0.4)
  let currentN = Math.round(cfg.wordCount * 0.5)
  let nextN = cfg.wordCount - reviewN - currentN
  if (options.reviewWords.length === 0) {
    currentN += nextN
    nextN = 0
  }

  const used = new Set<string>()
  const minLen = cfg.minLength

  const claim = (pool: Word[], n: number, seed: number): Word[] => {
    const outArr: Word[] = []
    for (const w of seededShuffle(pool, seed)) {
      if (outArr.length >= n) break
      const k = normalizeTerm(w.term)
      if (k.length >= minLen && !used.has(k)) {
        used.add(k)
        outArr.push(w)
      }
    }
    return outArr
  }

  const poolFor = (key: Cefr): Word[] => {
    const direct = options.pools[key]
    if (direct.length > 0) return direct
    // C2 has no dedicated pool in the core sets; fall back to C1.
    return CEFR_ORDER.filter(c => options.pools[c].length > 0).reduce(
      (acc, c) => (options.pools[c].length > acc.length ? options.pools[c] : acc),
      [] as Word[],
    )
  }

  const reviewWords = claim(options.reviewWords, reviewN, cfg.stage * 104729 + 1)
  const currentWords = claim(poolFor(current), currentN, cfg.stage * 7919 + 3)
  const nextWords = next
    ? claim(poolFor(next), nextN, cfg.stage * 104729 + 5)
    : []

  // generic top-up when chapter pools are exhausted
  const allPool = CEFR_ORDER.flatMap(c => options.pools[c])
  const fill: Word[] = [
    ...reviewWords,
    ...currentWords,
    ...nextWords,
  ]
  if (fill.length < cfg.wordCount && allPool.length > 0) {
    for (const w of seededShuffle(allPool, cfg.stage * 31 + 7)) {
      if (fill.length >= cfg.wordCount) break
      const k = normalizeTerm(w.term)
      if (k.length >= minLen && !used.has(k)) {
        used.add(k)
        fill.push(w)
      }
    }
  }

  return {
    stage: cfg.stage,
    chapter: cfg.chapter,
    difficulty: cfg.difficulty,
    words: fill,
  }
}