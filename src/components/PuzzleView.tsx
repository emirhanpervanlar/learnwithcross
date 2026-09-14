import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import type { Difficulty, Direction, Puzzle, PuzzleClue, PuzzleCell } from '../types'
import { getWordSetById } from '../data/sets'
import {
  usePuzzleSolver,
  type SolverCallbacks,
} from '../hooks/usePuzzleSolver'
import type { SessionSnapshot } from '../lib/storage'
import { DIFFICULTY_CONFIG, DIFFICULTY_LABEL } from '../lib/difficulty'

interface Props {
  puzzle: Puzzle
  /** restored state when resuming a previous puzzle, or null */
  session: SessionSnapshot | null
  onSessionChange: (snapshot: SessionSnapshot) => void
  onFinished: () => void
  onBack: () => void
  learning: SolverCallbacks
}

const DIR_LABEL: Record<Direction, string> = {
  across: 'Yatay (Across)',
  down: 'Dikey (Down)',
}

const DIR_SHORT: Record<Direction, string> = {
  across: 'Yatay',
  down: 'Dikey',
}

const DIFFICULTY_BADGE: Record<Difficulty, string> = {
  kolay: 'bg-green-50 text-green-700',
  normal: 'bg-amber-50 text-amber-700',
  zor: 'bg-rose-50 text-rose-700',
}

export function PuzzleView({
  puzzle,
  session,
  onSessionChange,
  onFinished,
  onBack,
  learning,
}: Props) {
  const initialState = session
    ? { entries: session.entries, active: session.active, hintsUsed: session.hintsUsed }
    : undefined
  const solver = usePuzzleSolver(puzzle, learning, initialState)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const [isMobile, setIsMobile] = useState(false)
  const [stickyOn, setStickyOn] = useState(false)
  const [barBottom, setBarBottom] = useState(0)

  const set = getWordSetById(puzzle.setSlug)
  const activeWordId = solver.currentWord()?.id
  const totalWords = puzzle.words.length
  const finished = solver.completed.size
  const allDone = finished === totalWords

  const acrossClues = puzzle.clues.filter(c => c.dir === 'across')
  const downClues = puzzle.clues.filter(c => c.dir === 'down')
  const activeClue = activeWordId ? puzzle.clues.find(c => c.wordId === activeWordId) : undefined

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  // persist progress while the puzzle is unfinished; report completion once
  const onSessionChangeRef = useRef(onSessionChange)
  onSessionChangeRef.current = onSessionChange
  const onFinishedRef = useRef(onFinished)
  onFinishedRef.current = onFinished

  const wasDone = useRef(false)
  useEffect(() => {
    if (allDone) {
      if (!wasDone.current) {
        wasDone.current = true
        onFinishedRef.current()
      }
      return
    }
    wasDone.current = false
    onSessionChangeRef.current({
      entries: solver.entries,
      active: solver.active,
      hintsUsed: solver.hintsUsed,
      checkMode: solver.checkMode,
    })
  }, [solver.entries, solver.active, solver.hintsUsed, solver.checkMode, allDone])

  // only on mobile: a sticky bottom bar shows the selected clue,
  // stays above the keyboard, and disables once the user scrolls away
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (!isMobile) return
    const GRID_GRACE = 40
    const update = () => {
      const el = gridRef.current
      if (el) setStickyOn(el.getBoundingClientRect().top >= -GRID_GRACE)
      const vv = window.visualViewport
      if (vv) setBarBottom(Math.max(0, Math.round(window.innerHeight - (vv.offsetTop + vv.height))))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.visualViewport?.addEventListener('scroll', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.visualViewport?.removeEventListener('scroll', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [isMobile])

  const onKeyDown = (e: KeyboardEvent) => {
    // The hidden input handles its own keys (mobile + after a cell tap)
    if (e.target === inputRef.current) return
    const k = e.key
    if (/^[a-zA-Z]$/.test(k)) {
      solver.inputLetter(k.toLowerCase())
      e.preventDefault()
    } else if (k === 'Backspace') {
      solver.erase()
      e.preventDefault()
    } else if (k === 'Delete') {
      const { active } = solver
      if (active) solver.erase()
    } else if (k === 'ArrowUp') {
      solver.move(-1, 0)
      e.preventDefault()
    } else if (k === 'ArrowDown') {
      solver.move(1, 0)
      e.preventDefault()
    } else if (k === 'ArrowLeft') {
      solver.move(0, -1)
      e.preventDefault()
    } else if (k === 'ArrowRight') {
      solver.move(0, 1)
      e.preventDefault()
    } else if (k === ' ' || k === 'Enter') {
      solver.toggleDir()
      e.preventDefault()
    }
  }

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const k = e.key
    if (k === 'Process' || k === 'Unidentified') return
    if (/^[a-zA-Z]$/.test(k)) {
      e.preventDefault()
      e.stopPropagation()
      solver.inputLetter(k.toLowerCase())
    } else if (k === 'Backspace' || k === 'Delete') {
      e.preventDefault()
      e.stopPropagation()
      solver.erase()
    } else if (k === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      solver.move(-1, 0)
    } else if (k === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      solver.move(1, 0)
    } else if (k === 'ArrowLeft') {
      e.preventDefault()
      e.stopPropagation()
      solver.move(0, -1)
    } else if (k === 'ArrowRight') {
      e.preventDefault()
      e.stopPropagation()
      solver.move(0, 1)
    } else if (k === ' ' || k === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      solver.toggleDir()
    }
  }

  // Fallback for IME / virtual keyboards that skip keydown events
  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    if (!v) return
    const ch = v[v.length - 1]
    if (/^[a-zA-Z]$/.test(ch)) {
      solver.inputLetter(ch.toLowerCase())
    }
    e.target.value = ''
  }

  const renderCell = (row: number, col: number, cell: PuzzleCell | undefined) => {
    const key = `${row},${col}`
    if (!cell) {
      return <div key={key} className="h-full w-full bg-slate-200" />
    }

    const inActiveWord =
      activeWordId !== undefined &&
      (cell.acrossId === activeWordId || cell.downId === activeWordId)
    const cellCompleted =
      (cell.acrossId && solver.completed.has(cell.acrossId)) ||
      (cell.downId && solver.completed.has(cell.downId))
    const isSelected = solver.active?.row === row && solver.active?.col === col
    const entered = solver.entries[key]

    let bg = cellCompleted ? 'bg-green-100' : 'bg-white'
    if (inActiveWord) bg = cellCompleted ? 'bg-green-100' : 'bg-indigo-50'
    if (isSelected) bg = 'bg-indigo-100'

    let textColor = 'text-slate-800'
    let ring = ''
    if (isSelected) ring = 'ring-2 ring-inset ring-indigo-500'
    if (solver.checkMode && entered) {
      textColor = entered === cell.letter ? 'text-green-600' : 'text-red-600'
    }

    return (
      <button
        key={key}
        type="button"
        onClick={() => {
          solver.select(row, col)
          inputRef.current?.focus()
        }}
        className={`relative z-10 flex h-full w-full items-center justify-center ${bg} ${ring} ${textColor} transition-colors focus:outline-none`}
        aria-label={`${row + 1}. satır, ${col + 1}. sütun`}
      >
        {cell.number != null && (
          <span className="absolute left-0.5 top-0 text-[9px] font-semibold text-slate-400">
            {cell.number}
          </span>
        )}
        {entered && (
          <span
            className={`uppercase ${
              cell.given ? 'font-extrabold' : 'font-semibold'
            }`}
            style={{ fontSize: `clamp(0.75rem, calc(100vw / ${puzzle.width} * 0.5), 1.125rem)` }}
          >
            {entered}
          </span>
        )}
      </button>
    )
  }

  const hintConfig = DIFFICULTY_CONFIG[puzzle.difficulty]

  const cellSize = `clamp(1.4rem, calc((100vw - 56px) / ${puzzle.width}), 2.5rem)`

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="rounded-lg outline-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="text-sm font-medium text-slate-500 transition hover:text-indigo-600"
        >
          ← Set Detayı
        </button>
        <h2 className="text-lg font-bold text-slate-900">
          {set?.name ?? puzzle.setSlug} Bulmacası
        </h2>
        <div className="flex flex-wrap gap-2">
          {hintConfig.hintLimit !== 0 && (
            <button
              onClick={solver.hint}
              disabled={!solver.hintAvailable}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                solver.hintAvailable
                  ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100'
                  : 'border-slate-300 bg-white text-slate-500'
              }`}
            >
              {hintConfig.hintLimit < 0
                ? 'İpucu Göster'
                : `İpucu (${solver.hintsLeft})`}
            </button>
          )}
          <button
            onClick={() => solver.toggleCheck()}
            className={`rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium transition ${
              solver.checkMode
                ? 'border-indigo-400 text-indigo-600'
                : 'text-slate-700 hover:border-indigo-400 hover:text-indigo-600'
            }`}
          >
            {solver.checkMode ? 'Kontrol (açık)' : 'Kontrol Et'}
          </button>
          <button
            onClick={solver.clearAll}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-red-400 hover:text-red-600"
          >
            Temizle
          </button>
        </div>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span
          className={`rounded-full px-2 py-0.5 font-semibold ${DIFFICULTY_BADGE[puzzle.difficulty]}`}
        >
          {DIFFICULTY_LABEL[puzzle.difficulty]}
        </span>
        <span>
          {puzzle.words.length} kelime · {puzzle.width}×{puzzle.height} ızgara
        </span>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
          {finished}/{totalWords} kelime tamamlandı
        </span>
      </div>

      {allDone && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          Tebrikler! Bulmacanın tamamını çözdün 🎉
        </div>
      )}

      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div
          ref={gridRef}
          className="w-full max-w-full overflow-x-auto lg:w-auto lg:shrink-0 lg:max-w-[min(100%,620px)]"
        >
          <div className="relative mx-auto w-fit">
            <div
              className="relative z-10 grid gap-px overflow-hidden rounded-lg border border-slate-300 bg-slate-300"
              style={{
                gridTemplateColumns: `repeat(${puzzle.width}, ${cellSize})`,
                gridTemplateRows: `repeat(${puzzle.height}, ${cellSize})`,
              }}
            >
              {Array.from({ length: puzzle.height * puzzle.width }, (_, idx) => {
                const row = Math.floor(idx / puzzle.width)
                const col = idx % puzzle.width
                return renderCell(row, col, solver.cellMap.get(`${row},${col}`))
              })}
            </div>
            <input
              ref={inputRef}
              type="text"
              inputMode="text"
              aria-label="Bulmaca girişi"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              onChange={onInputChange}
              onKeyDown={onInputKeyDown}
              className="absolute inset-0 z-0 h-full w-full cursor-text opacity-0"
            />
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">
            Hücreye dokunup klavyeden yaz ya da geri sil.
          </p>
        </div>

        <div className="grid min-w-0 flex-1 gap-6 sm:grid-cols-2 lg:grid-cols-1">
          {([['across', acrossClues], ['down', downClues]] as const).map(([dir, clues]) => (
            <div key={dir} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {DIR_LABEL[dir]}
              </h3>
              <ol className="mt-3 grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-1">
                {clues.map(clue => (
                  <ClueRow
                    key={clue.id}
                    clue={clue}
                    active={clue.wordId === activeWordId}
                    completed={solver.completed.has(clue.wordId)}
                    onSelect={() => solver.gotoWord(clue.wordId)}
                  />
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      {isMobile && stickyOn && (
        <>
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden"
            style={{ bottom: barBottom }}
          >
            <div className="mx-auto flex max-w-6xl items-center gap-3">
              <span className="shrink-0 rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                {activeClue ? `${activeClue.number} ${DIR_SHORT[activeClue.dir]}` : '—'}
              </span>
              <span className="flex-1 text-sm font-medium text-slate-800">
                {activeClue ? activeClue.text : 'Bir hücre seç; ipucu burada görünür.'}
              </span>
            </div>
          </div>
          <div className="h-16 lg:hidden" aria-hidden="true" />
        </>
      )}
    </div>
  )
}

function ClueRow({
  clue,
  active,
  completed,
  onSelect,
}: {
  clue: PuzzleClue
  active: boolean
  completed: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full gap-2 rounded px-2 py-1 text-left text-sm transition ${
          completed
            ? 'bg-green-50 text-slate-500'
            : active
              ? 'bg-indigo-50 text-slate-900 ring-1 ring-inset ring-indigo-200'
              : 'text-slate-700 hover:bg-slate-50'
        }`}
      >
        <span className="w-5 shrink-0 font-semibold text-indigo-600">{clue.number}.</span>
        <span className="flex-1">{clue.text}</span>
        {completed && <span className="shrink-0 text-green-600">✓</span>}
      </button>
    </li>
  )
}