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
    expect(levelFor(0)).toMatchObject({ number: 1, name: 'Başlangıç', nextAt: 15 })
    expect(levelFor(15)).toMatchObject({ number: 2, name: 'Gelişiyor', nextAt: 40 })
    expect(levelFor(40)).toMatchObject({ number: 3, name: 'İyi', nextAt: 80 })
    expect(levelFor(80)).toMatchObject({ number: 4, name: 'Çok İyi', nextAt: 140 })
    expect(levelFor(140)).toMatchObject({ number: 5, name: 'Usta', nextAt: 220 })
    expect(levelFor(220)).toMatchObject({ number: 6, name: 'Uzman', nextAt: 330 })
    expect(levelFor(330)).toMatchObject({ number: 7, name: 'Kurmay', nextAt: 480 })
    expect(levelFor(480)).toMatchObject({ number: 8, name: 'Şampiyon', nextAt: 680 })
    expect(levelFor(680)).toMatchObject({ number: 9, name: 'Efsane', nextAt: 1000 })
    expect(levelFor(1000)).toMatchObject({ number: 10, name: 'Titanyum', nextAt: null })
    expect(levelFor(2000)).toMatchObject({ number: 10, progress: 1 })
  })

  it('reports progress between thresholds', () => {
    const lv = levelFor(10)
    expect(lv.number).toBe(1)
    expect(lv.nextAt).toBe(15)
    expect(lv.progress).toBeCloseTo(10 / 15, 5)

    const lvHigh = levelFor(99)
    expect(lvHigh.number).toBe(4)
    expect(lvHigh.nextAt).toBe(140)
    expect(lvHigh.progress).toBeCloseTo((99 - 80) / (140 - 80), 5)
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