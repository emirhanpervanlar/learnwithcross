import { describe, expect, it } from 'vitest'
import type { LearningMap, PlacedWord } from '../types'
import { levelFor, recordCompleted, recordCorrect, recordWorked } from './learning'

const word: PlacedWord = {
  id: 'w0',
  letters: 'giveup',
  display: 'give up',
  clue: 'to quit',
  row: 0,
  col: 0,
  dir: 'across',
  length: 6,
}

const other: PlacedWord = { ...word, id: 'w1', display: 'look after', letters: 'lookafter' }

describe('levelFor', () => {
  it('starts at Başlangıç and progresses through 10 thresholds', () => {
    expect(levelFor(0)).toMatchObject({ number: 1, name: 'Başlangıç', nextAt: 5 })
    expect(levelFor(5)).toMatchObject({ number: 2, name: 'Gelişiyor', nextAt: 15 })
    expect(levelFor(15)).toMatchObject({ number: 3, name: 'İyi', nextAt: 30 })
    expect(levelFor(30)).toMatchObject({ number: 4, name: 'Çok İyi', nextAt: 50 })
    expect(levelFor(50)).toMatchObject({ number: 5, name: 'Usta', nextAt: 70 })
    expect(levelFor(70)).toMatchObject({ number: 6, name: 'Uzman', nextAt: 95 })
    expect(levelFor(95)).toMatchObject({ number: 7, name: 'Kurmay', nextAt: 125 })
    expect(levelFor(125)).toMatchObject({ number: 8, name: 'Şampiyon', nextAt: 160 })
    expect(levelFor(160)).toMatchObject({ number: 9, name: 'Efsane', nextAt: 200 })
    expect(levelFor(200)).toMatchObject({ number: 10, name: 'Titanyum', nextAt: null })
    expect(levelFor(500)).toMatchObject({ number: 10, progress: 1 })
  })

  it('reports progress between thresholds', () => {
    const lv = levelFor(10)
    expect(lv.number).toBe(2)
    expect(lv.nextAt).toBe(15)
    expect(lv.progress).toBe(0.5)

    const lvHigh = levelFor(99)
    expect(lvHigh.number).toBe(7)
    expect(lvHigh.nextAt).toBe(125)
    expect(lvHigh.progress).toBeCloseTo((99 - 95) / (125 - 95), 5)
  })
})

describe('learning records', () => {
  it('accumulates worked points per word', () => {
    let map: LearningMap = {}
    map = recordWorked(map, word, 's1', 'Oxford')
    map = recordWorked(map, word, 's1', 'Oxford')
    map = recordWorked(map, other, 's1', 'Oxford')
    expect(map['s1::w0']?.score).toBe(2)
    expect(map['s1::w1']?.score).toBe(1)
    expect(map['s1::w0']?.wordText).toBe('give up')
  })

  it('tracks correctness and completion bonuses', () => {
    let map: LearningMap = {}
    map = recordWorked(map, word, 's1', 'Oxford')
    map = recordCorrect(map, word, 's1', 'Oxford')
    map = recordCompleted(map, word, 's1', 'Oxford')
    const entry = map['s1::w0']
    expect(entry.score).toBe(13)
    expect(entry.completedCount).toBe(1)
  })

  it('keeps different sets apart even with colliding word ids', () => {
    let map: LearningMap = {}
    map = recordWorked(map, word, 's1', 'Oxford')
    map = recordWorked(map, word, 's2', 'Cambridge')
    expect(Object.keys(map).length).toBe(2)
    expect(map['s1::w0'].score).toBe(1)
    expect(map['s2::w0'].score).toBe(1)
  })
})