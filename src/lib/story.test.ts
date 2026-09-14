import { describe, expect, it } from 'vitest'
import type { Word } from '../types'
import {
  STORY_CHAPTERS,
  STORY_STAGES,
  buildCefrPools,
  buildStageWords,
  chapterForStage,
  nextStageFor,
  recommendedStartStage,
  startStageFor,
  stageConfig,
} from './story'

const w = (term: string, level: string): Word => ({ term, definition: `def of ${term}`, level })

/** Unique, letter-only terms (normalizeTerm strips digits). */
const term = (prefix: string, i: number): string =>
  `${prefix}${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`

describe('story chapters', () => {
  it('covers stages 1..100 in six chapters', () => {
    expect(STORY_CHAPTERS.length).toBe(6)
    expect(STORY_CHAPTERS[0].start).toBe(1)
    expect(STORY_CHAPTERS[STORY_CHAPTERS.length - 1].end).toBe(STORY_STAGES)
  })

  it('maps each stage to the right chapter', () => {
    expect(chapterForStage(1).cefr).toBe('A1')
    expect(chapterForStage(15).cefr).toBe('A1')
    expect(chapterForStage(16).cefr).toBe('A2')
    expect(chapterForStage(31).cefr).toBe('B1')
    expect(chapterForStage(67).cefr).toBe('C1')
    expect(chapterForStage(100).cefr).toBe('C2')
  })

  it('computes start and next stages', () => {
    expect(startStageFor('B1')).toBe(31)
    expect(startStageFor('C2')).toBe(85)
    expect(nextStageFor(0)).toBe(1)
    expect(nextStageFor(7)).toBe(8)
    expect(nextStageFor(100)).toBe(100)
  })

  it('recommends a start stage from the player level', () => {
    expect(recommendedStartStage(1)).toBe(1)
    expect(recommendedStartStage(3)).toBe(16)
    expect(recommendedStartStage(12)).toBe(49)
    expect(recommendedStartStage(18)).toBe(67)
    expect(recommendedStartStage(25)).toBe(85)
  })
})

describe('stageConfig', () => {
  it('scales word count and minimum length', () => {
    expect(stageConfig(1).wordCount).toBe(6)
    expect(stageConfig(100).wordCount).toBe(18)
    expect(stageConfig(20).minLength).toBe(3)
    expect(stageConfig(50).minLength).toBe(4)
    expect(stageConfig(90).minLength).toBe(5)
  })

  it('moves difficulty through easy → normal → hard inside a chapter', () => {
    expect(stageConfig(1).difficulty).toBe('kolay')
    expect(stageConfig(8).difficulty).toBe('normal')
    expect(stageConfig(14).difficulty).toBe('zor')
  })
})

describe('buildCefrPools', () => {
  it('groups words by level and skips duplicates and level-less words', () => {
    const pools = buildCefrPools([
      w('apple', 'A1'),
      w('apple', 'A1'), // duplicate term
      w('banana', 'A2'),
      w('rocket science', 'C1'),
      w('mystery', ''), // no level
      w('random', 'ZZ'), // unknown level
    ])
    expect(pools.A1.length).toBe(1)
    expect(pools.A2.length).toBe(1)
    expect(pools.C1.length).toBe(1)
    expect(pools.C2.length).toBe(0)
    expect(pools.B1.length).toBe(0)
  })
})

describe('buildStageWords (40/50/10 recipe)', () => {
  const pools = buildCefrPools([
    ...Array.from({ length: 60 }, (_, i) => w(term('current', i), 'A2')),
    ...Array.from({ length: 60 }, (_, i) => w(term('next', i), 'B1')),
  ])
  const reviewWords = Array.from({ length: 30 }, (_, i) => w(term('review', i), 'B1'))

  it('keeps the requested word count and mixes the three sources', () => {
    const recipe = buildStageWords({ stage: 20, pools, reviewWords })
    expect(recipe.words.length).toBe(stageConfig(20).wordCount) // 8
    const normTerms = recipe.words.map(x => x.term)
    const reviewCount = normTerms.filter(t => t.startsWith('review')).length
    const currentCount = normTerms.filter(t => t.startsWith('current')).length
    const nextCount = normTerms.filter(t => t.startsWith('next')).length
    expect(reviewCount).toBe(3) // round(8 * 0.4)
    expect(currentCount).toBe(4) // round(8 * 0.5)
    expect(nextCount).toBe(1) // 8 - 3 - 4
  })

  it('never repeats a word', () => {
    const recipe = buildStageWords({ stage: 40, pools, reviewWords })
    const terms = recipe.words.map(x => x.term)
    expect(new Set(terms).size).toBe(recipe.words.length)
  })

  it('uses only current words when there is no review list', () => {
    const recipe = buildStageWords({ stage: 10, pools, reviewWords: [] })
    expect(recipe.words.length).toBe(stageConfig(10).wordCount)
    expect(recipe.words.every(x => x.term.startsWith('current'))).toBe(true)
  })

  it('is deterministic for the same stage', () => {
    const a = buildStageWords({ stage: 33, pools, reviewWords })
    const b = buildStageWords({ stage: 33, pools, reviewWords })
    expect(a.words.map(x => x.term)).toEqual(b.words.map(x => x.term))
  })

  it('falls back to other pools when the chapter pool is exhausted', () => {
    const tiny = buildCefrPools([
      ...Array.from({ length: 3 }, (_, i) => w(term('cur', i), 'B2')),
      ...Array.from({ length: 40 }, (_, i) => w(term('other', i), 'C1')),
    ])
    const recipe = buildStageWords({ stage: 60, pools: tiny, reviewWords: [] })
    expect(recipe.words.length).toBe(stageConfig(60).wordCount)
  })
})