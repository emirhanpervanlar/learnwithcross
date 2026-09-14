import { useEffect, useMemo, useRef, useState } from 'react'
import type { Direction, PlacedWord, Puzzle, PuzzleCell } from '../types'
import { DIFFICULTY_CONFIG } from '../lib/difficulty'

export interface ActiveCell {
  row: number
  col: number
  dir: Direction
}

export type EntryMap = Record<string, string>

export interface SolverCallbacks {
  onWordWorked?: (word: PlacedWord) => void
  onNewCorrectLetter?: (word: PlacedWord) => void
  onWordComplete?: (word: PlacedWord) => void
}

export interface SolverInitialState {
  entries?: EntryMap
  active?: ActiveCell | null
  hintsUsed?: number
}

export function usePuzzleSolver(
  puzzle: Puzzle,
  callbacks?: SolverCallbacks,
  initialState?: SolverInitialState,
) {
  const cellMap = useMemo(() => {
    const m = new Map<string, PuzzleCell>()
    for (const c of puzzle.cells) m.set(`${c.row},${c.col}`, c)
    return m
  }, [puzzle])

  const wordsById = useMemo(() => new Map(puzzle.words.map(w => [w.id, w] as const)), [puzzle])

  const cellsOfWord = useMemo(() => {
    const memo = new Map<string, { key: string; row: number; col: number; letter: string }[]>()
    for (const w of puzzle.words) {
      memo.set(
        w.id,
        Array.from({ length: w.length }, (_, i) => {
          const row = w.row + (w.dir === 'down' ? i : 0)
          const col = w.col + (w.dir === 'across' ? i : 0)
          return { key: `${row},${col}`, row, col, letter: w.letters[i] }
        }),
      )
    }
    return memo
  }, [puzzle])

  const cfg = DIFFICULTY_CONFIG[puzzle.difficulty]

  const [entries, setEntries] = useState<EntryMap>(() => {
    const base = { ...(initialState?.entries ?? {}) }
    for (const c of puzzle.cells) if (c.given) base[`${c.row},${c.col}`] = c.letter
    return base
  })
  const [active, setActive] = useState<ActiveCell | null>(initialState?.active ?? null)
  const [checkMode, setCheckMode] = useState(false)
  const [hintsUsed, setHintsUsed] = useState(initialState?.hintsUsed ?? 0)

  const revealed = useRef<Set<string>>(new Set())
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  const completed = useMemo(() => {
    const set = new Set<string>()
    for (const [id, cells] of cellsOfWord) {
      if (cells.every(c => entries[c.key] === c.letter)) set.add(id)
    }
    return set
  }, [cellsOfWord, entries])

  const completedRef = useRef<Set<string>>(completed)
  useEffect(() => {
    for (const id of completed) {
      if (!completedRef.current.has(id)) {
        const word = wordsById.get(id)
        if (word) callbacksRef.current?.onWordComplete?.(word)
      }
    }
    completedRef.current = completed
  }, [completed, wordsById])

  const hasWordAt = (row: number, col: number, dir: Direction): boolean => {
    const cell = cellMap.get(`${row},${col}`)
    if (!cell) return false
    return dir === 'across' ? !!cell.acrossId : !!cell.downId
  }

  const deriveDirAt = (row: number, col: number): Direction =>
    hasWordAt(row, col, 'across') ? 'across' : 'down'

  const currentWord = (): PlacedWord | null => {
    if (!active) return null
    const cell = cellMap.get(`${active.row},${active.col}`)
    if (!cell) return null
    const id = active.dir === 'across' ? cell.acrossId : cell.downId
    return id ? wordsById.get(id) ?? null : null
  }

  const select = (row: number, col: number) => {
    if (!hasWordAt(row, col, 'across') && !hasWordAt(row, col, 'down')) return
    if (active && active.row === row && active.col === col) {
      toggleDir()
      return
    }
    const preferred = active?.dir ?? 'across'
    const dir: Direction = hasWordAt(row, col, preferred) ? preferred : deriveDirAt(row, col)
    setActive({ row, col, dir })
  }

  const toggleDir = () => {
    if (!active) return
    const nd: Direction = active.dir === 'across' ? 'down' : 'across'
    if (hasWordAt(active.row, active.col, nd)) setActive({ ...active, dir: nd })
  }

  const putCell = (k: string) => {
    setEntries(prev => {
      const next = { ...prev }
      delete next[k]
      return next
    })
  }

  const isLocked = (k: string): boolean => {
    if (revealed.current.has(k)) return true
    const cell = cellMap.get(k)
    if (!cell) return false
    if (cell.given) return true
    if (cell.acrossId && completed.has(cell.acrossId)) return true
    if (cell.downId && completed.has(cell.downId)) return true
    return false
  }

  const advanceToNextNonLocked = (word: PlacedWord, fromKey: string) => {
    const cells = cellsOfWord.get(word.id)!
    const idx = cells.findIndex(c => c.key === fromKey)
    for (let i = idx + 1; i < cells.length; i++) {
      if (!isLocked(cells[i].key)) {
        setActive({ row: cells[i].row, col: cells[i].col, dir: word.dir })
        return
      }
    }
  }

  const moveBackToPrevNonLocked = () => {
    if (!active) return
    const word = currentWord()
    if (!word) return
    const cells = cellsOfWord.get(word.id)!
    const idx = cells.findIndex(c => c.key === `${active.row},${active.col}`)
    for (let i = idx - 1; i >= 0; i--) {
      if (!isLocked(cells[i].key)) {
        setActive({ row: cells[i].row, col: cells[i].col, dir: word.dir })
        return
      }
    }
  }

  const inputLetter = (ch: string) => {
    if (!active) return
    const word = currentWord()
    if (!word) return
    const k = `${active.row},${active.col}`

    if (isLocked(k)) {
      advanceToNextNonLocked(word, k)
      return
    }

    const correct = cellMap.get(k)?.letter
    const wasCorrect = correct != null && entries[k] === correct
    setEntries(prev => ({ ...prev, [k]: ch }))
    callbacksRef.current?.onWordWorked?.(word)
    if (!wasCorrect && correct === ch && !revealed.current.has(k)) {
      callbacksRef.current?.onNewCorrectLetter?.(word)
    }
    advanceToNextNonLocked(word, k)
  }

  const erase = () => {
    if (!active) return
    const k = `${active.row},${active.col}`

    if (isLocked(k)) {
      moveBackToPrevNonLocked()
      return
    }
    if (entries[k]) {
      putCell(k)
      return
    }
    moveBackToPrevNonLocked()
  }

  const move = (dr: number, dc: number) => {
    if (!active) return
    const { row, col, dir } = active
    const alongAxis = (dr !== 0 && dir === 'down') || (dc !== 0 && dir === 'across')
    if (!alongAxis) {
      const nd: Direction = dir === 'across' ? 'down' : 'across'
      if (hasWordAt(row, col, nd)) {
        setActive({ row, col, dir: nd })
        return
      }
    }
    let nr = row + dr
    let nc = col + dc
    while (nr >= 0 && nc >= 0 && nr < puzzle.height && nc < puzzle.width) {
      if (cellMap.has(`${nr},${nc}`)) {
        setActive({ row: nr, col: nc, dir })
        return
      }
      nr += dr
      nc += dc
    }
  }

  const gotoWord = (clueWordId: string) => {
    const word = wordsById.get(clueWordId)
    if (!word) return
    setActive({ row: word.row, col: word.col, dir: word.dir })
  }

  const clearAll = () => {
    setEntries(prev => {
      const curCompleted = new Set<string>()
      for (const [id, cells] of cellsOfWord) {
        if (cells.every(c => prev[c.key] === c.letter)) curCompleted.add(id)
      }
      const next = { ...prev }
      for (const k of Object.keys(next)) {
        if (revealed.current.has(k)) continue
        const cell = cellMap.get(k)
        if (cell?.given) continue
        if (cell?.acrossId && curCompleted.has(cell.acrossId)) continue
        if (cell?.downId && curCompleted.has(cell.downId)) continue
        delete next[k]
      }
      return next
    })
  }

  const toggleCheck = () => setCheckMode(v => !v)

  const filledFraction = (wordId: string): number => {
    const cells = cellsOfWord.get(wordId)!
    if (cells.length === 0) return 0
    let filled = 0
    for (const c of cells) if (entries[c.key] === c.letter) filled++
    return filled / cells.length
  }

  const hintLimit = cfg.hintLimit
  const hintsLeft = hintLimit < 0 ? Infinity : Math.max(0, hintLimit - hintsUsed)

  const hintActionWord = currentWord()
  const hintAvailable = (() => {
    if (hintLimit === 0 || hintsLeft <= 0 || !hintActionWord) return false
    if (cfg.hintRule80 && filledFraction(hintActionWord.id) >= 0.8) return false
    const cells = cellsOfWord.get(hintActionWord.id)!
    return cells.some(c => !isLocked(c.key) && entries[c.key] !== c.letter)
  })()

  const hint = () => {
    if (!hintAvailable) return
    const word = hintActionWord
    if (!word) return
    const cells = cellsOfWord.get(word.id)!
    const target = cells.find(c => !isLocked(c.key) && entries[c.key] !== c.letter)
    if (!target) return
    setEntries(prev => ({ ...prev, [target.key]: target.letter }))
    revealed.current.add(target.key)
    setHintsUsed(n => n + 1)
  }

  return {
    cellMap,
    entries,
    active,
    checkMode,
    completed,
    hintsUsed,
    hintsLeft,
    hintAvailable,
    currentWord,
    select,
    toggleDir,
    inputLetter,
    erase,
    move,
    gotoWord,
    clearAll,
    toggleCheck,
    filledFraction,
    hint,
  }
}