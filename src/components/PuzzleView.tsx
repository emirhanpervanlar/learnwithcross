import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, TouchEvent } from 'react'
import type { Difficulty, Direction, Puzzle, PuzzleClue, PuzzleCell } from '../types'
import { getWordSetById } from '../data/sets'
import { latinize } from '../lib/crossword'
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
  const slideScrollerRef = useRef<HTMLDivElement>(null)

  const [isMobile, setIsMobile] = useState(false)
  const [barBottom, setBarBottom] = useState(0)
  const [desktopCellPx, setDesktopCellPx] = useState<number | null>(null)

  const set = getWordSetById(puzzle.setSlug)
  const activeWordId = solver.currentWord()?.id
  const totalWords = puzzle.words.length
  const finished = solver.completed.size
  const allDone = finished === totalWords

  const acrossClues = puzzle.clues.filter(c => c.dir === 'across')
  const downClues = puzzle.clues.filter(c => c.dir === 'down')
  const orderedClues = useMemo(() => [...acrossClues, ...downClues], [acrossClues, downClues])

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  // active cell ref so the keyboard-auto-scroll effect can read the newest value
  const activeRef = useRef(solver.active)
  activeRef.current = solver.active

  // desktop: size the grid to fill the available row width (mobile keeps its formula)
  useEffect(() => {
    if (isMobile) return
    const el = gridRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setDesktopCellPx(Math.floor(w / puzzle.width))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [isMobile, puzzle.width])

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

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // keep the bottom slide above the virtual keyboard and the active cell visible
  useEffect(() => {
    if (!isMobile) return
    const scrollActiveIntoView = () => {
      const active = activeRef.current
      if (!active) return
      const vv = window.visualViewport
      if (!vv) return
      const keyboardOpen = vv.height < window.innerHeight - 80
      if (!keyboardOpen) return
      const el = gridRef.current?.querySelector<HTMLElement>(
        `[data-cell="${active.row}-${active.col}"]`,
      )
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.top < 0 || r.bottom > vv.height) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
    const update = () => {
      const vv = window.visualViewport
      if (vv) setBarBottom(Math.max(0, Math.round(window.innerHeight - (vv.offsetTop + vv.height))))
      scrollActiveIntoView()
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

  // keep the active clue visible inside the swipeable slide
  useEffect(() => {
    if (!isMobile || !activeWordId) return
    const chip = slideScrollerRef.current?.querySelector<HTMLElement>(
      `[data-word="${activeWordId}"]`,
    )
    if (chip) chip.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [activeWordId, isMobile])

  const focusInput = () => inputRef.current?.focus()

  const navigateSlide = (delta: number) => {
    const usable = orderedClues.filter(c => !solver.completed.has(c.wordId))
    const list = usable.length > 0 ? usable : orderedClues
    const idx = list.findIndex(c => c.wordId === activeWordId)
    const target = list[(((idx < 0 ? 0 : idx) + delta) % list.length + list.length) % list.length]
    if (!target) return
    solver.gotoWord(target.wordId)
    focusInput()
  }

  const touchX = useRef<number | null>(null)
  const touchScrollLeft = useRef<number>(0)
  const onSlideTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchX.current = e.touches[0]?.clientX ?? null
    touchScrollLeft.current = e.currentTarget.scrollLeft
  }
  const onSlideTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchX.current == null) return
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current
    // if the user was scrolling the chip strip, don't hijack it into navigation
    if (Math.abs(e.currentTarget.scrollLeft - touchScrollLeft.current) > 10) {
      touchX.current = null
      return
    }
    touchX.current = null
    if (dx <= -40) navigateSlide(1)
    else if (dx >= 40) navigateSlide(-1)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // The hidden input handles its own keys (mobile + after a cell tap)
    if (e.target === inputRef.current) return
    const raw = e.key
    if (raw === 'Process' || raw === 'Unidentified') return
    const k = latinize(raw)
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
    const raw = e.key
    if (raw === 'Process' || raw === 'Unidentified') return
    const k = latinize(raw)
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
    const ch = latinize(v[v.length - 1])
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
        data-cell={key}
        onClick={() => {
          solver.select(row, col)
          focusInput()
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

  // mobile: viewport-based sizing; desktop: fills the flex row (capped huge)
  const cellSize =
    isMobile || desktopCellPx == null
      ? `clamp(1.4rem, calc((100vw - 56px) / ${puzzle.width}), 2.5rem)`
      : `${Math.max(24, Math.min(desktopCellPx, 64))}px`

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="rounded-lg outline-none"
    >
      {/* mobile: a single close button lives in the fullscreen shell; here only title */}
      <div className="flex items-center justify-center gap-3 py-1 lg:justify-between">
        <button
          onClick={onBack}
          className="hidden text-sm font-medium text-slate-500 transition hover:text-indigo-600 lg:inline-flex"
        >
          ← Set Detayı
        </button>
        <h2 className="shrink-0 text-lg font-bold text-slate-900">
          {set?.name ?? puzzle.setSlug} Bulmacası
        </h2>
        <div className="hidden items-center gap-2 lg:flex">
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

      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start">
        <div
          ref={gridRef}
          className="w-full max-w-full overflow-x-auto lg:min-w-0 lg:flex-1"
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

        <div className="hidden min-w-0 flex-1 gap-6 sm:grid-cols-2 lg:grid lg:w-80 lg:shrink-0 lg:flex-none lg:grid-cols-1">
          {([['across', acrossClues], ['down', downClues]] as const).map(([dir, clues]) => (
            <div key={dir} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {dir === 'across' ? 'Yatay (Across)' : 'Dikey (Down)'}
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

      {isMobile && (
        <div
          className="anim-rise fixed inset-x-0 z-50 border-t border-slate-200 bg-white/95 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] backdrop-blur lg:hidden"
          style={{ bottom: barBottom }}
          role="region"
          aria-label="Sorular"
        >
          <div className="mx-auto flex max-w-6xl items-stretch gap-1 px-1 py-2">
            <button
              type="button"
              onClick={() => navigateSlide(-1)}
              aria-label="Önceki soru"
              className="flex shrink-0 items-center justify-center rounded-lg px-2 text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600 active:bg-slate-200"
            >
              ‹
            </button>
            <div
              ref={slideScrollerRef}
              className="nice-scroll flex gap-2 overflow-x-auto scroll-smooth px-1 py-1"
              onTouchStart={onSlideTouchStart}
              onTouchEnd={onSlideTouchEnd}
              style={{ scrollbarWidth: 'none' }}
            >
              {orderedClues.map(clue => {
                const isActive = clue.wordId === activeWordId
                const isDone = solver.completed.has(clue.wordId)
                return (
                  <button
                    key={clue.id}
                    type="button"
                    data-word={clue.wordId}
                    onClick={() => {
                      solver.gotoWord(clue.wordId)
                      focusInput()
                    }}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition ${
                      isActive
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow'
                        : isDone
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-slate-200 bg-slate-50 text-slate-700 active:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold">{clue.number}</span>
                    <span
                      className={`text-[10px] uppercase ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}
                    >
                      {DIR_SHORT[clue.dir]}
                    </span>
                    <span className="max-w-44 truncate">{clue.text}</span>
                    {isDone && <span className="text-green-600">✓</span>}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => navigateSlide(1)}
              aria-label="Sonraki soru"
              className="flex shrink-0 items-center justify-center rounded-lg px-2 text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600 active:bg-slate-200"
            >
              ›
            </button>
          </div>
        </div>
      )}
      {isMobile && <div className="h-20 lg:hidden" aria-hidden="true" />}
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