import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENTS,
  XP_REWARD,
  addXp,
  computeUnlocked,
  createProfile,
  dayKey,
  playerLevelFromXp,
  touchPracticeDay,
  wordLevelUpXp,
  xpForLevel,
} from './gamification'
import type { Metrics } from './gamification'

const baseMetrics: Metrics = {
  xp: 0,
  playerLevel: 1,
  puzzlesCompleted: 0,
  hardPuzzles: 0,
  noHintPuzzles: 0,
  hintsUsed: 0,
  wordsLearned: 0,
  wordCompletions: 0,
  wordsAtMasterMax: 0,
  practiceDays: 0,
  storyCleared: 0,
  resumes: 0,
  topicSolved: 0,
  hasProfile: false,
  storyStarted: false,
}

const metric = (patch: Partial<Metrics>): Metrics => ({ ...baseMetrics, ...patch })

describe('player XP / level', () => {
  it('awards fixed XP per difficulty', () => {
    expect(XP_REWARD).toEqual({ kolay: 40, normal: 60, zor: 90 })
  })

  it('places xp on a quadratic level curve', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(100)
    expect(xpForLevel(5)).toBe(1600)
  })

  it('derives the player level from total xp', () => {
    expect(playerLevelFromXp(0).level).toBe(1)
    expect(playerLevelFromXp(99).level).toBe(1)
    expect(playerLevelFromXp(100).level).toBe(2)
    expect(playerLevelFromXp(1599).level).toBe(4)
    expect(playerLevelFromXp(1600).level).toBe(5)
  })

  it('reports progress and next threshold', () => {
    const info = playerLevelFromXp(1250)
    expect(info.level).toBe(4)
    expect(info.currentXp).toBe(900)
    expect(info.nextXp).toBe(1600)
    expect(info.progress).toBeCloseTo((1250 - 900) / (1600 - 900), 5)
  })

  it('gives a word-level bonus proportional to the level', () => {
    expect(wordLevelUpXp(1)).toBe(0)
    expect(wordLevelUpXp(5)).toBe(40)
    expect(wordLevelUpXp(10)).toBe(90)
  })
})

describe('profile helpers', () => {
  it('tracks unique practice days', () => {
    const p = createProfile('Ada')
    const day = dayKey(Date.now())
    const once = touchPracticeDay(p)
    const twice = touchPracticeDay(once)
    expect(once.practiceDays).toEqual([day])
    expect(twice.practiceDays.length).toBe(1)
  })

  it('adds xp without going negative', () => {
    const p = createProfile('Ada')
    expect(addXp(p, 60).xp).toBe(60)
    expect(addXp(p, -50).xp).toBe(0)
  })
})

describe('achievement catalog', () => {
  it('contains exactly 100 achievements', () => {
    expect(ACHIEVEMENTS.length).toBe(100)
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(100)
  })

  it('unlocks the first-profile achievement when a profile exists', () => {
    const unlocked = computeUnlocked(metric({ hasProfile: true }))
    expect(unlocked).toContain('first-profile')
  })

  it('does not unlock anything for a blank profile', () => {
    expect(computeUnlocked(baseMetrics)).toEqual([])
  })

  it('unlocks threshold achievements once their metric is met', () => {
    const unlocked = computeUnlocked(
      metric({ playerLevel: 5, xp: 1600, puzzlesCompleted: 3, wordsLearned: 20, practiceDays: 2 }),
    )
    expect(unlocked).toContain('level-4') // level >= 5 → target index 3 (level 5)
  })

  it('unlocks the ten first milestones', () => {
    const idList = computeUnlocked(
      metric({
        hasProfile: true,
        playerLevel: 2,
        hintsUsed: 1,
        practiceDays: 1,
        puzzlesCompleted: 1,
        wordsLearned: 1,
        storyStarted: true,
        resumes: 1,
        topicSolved: 1,
        wordsAtMasterMax: 1,
      }),
    )
    for (const id of [
      'first-profile',
      'first-puzzle',
      'first-word',
      'first-hint',
      'first-levelup',
      'first-story',
      'first-resume',
      'first-topic',
      'first-day',
      'first-master',
    ]) {
      expect(idList).toContain(id)
    }
  })
})