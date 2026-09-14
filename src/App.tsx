import { useEffect, useRef, useState } from 'react'
import { builtInWordSets, getWordSetById } from './data/sets'
import { SetCatalog } from './components/SetCatalog'
import { SetDetail } from './components/SetDetail'
import { PuzzleView } from './components/PuzzleView'
import { LearningView } from './components/LearningView'
import { buildPuzzle } from './lib/crossword'
import {
  loadLearning,
  recordCompleted,
  recordCorrect,
  recordWorked,
  saveLearning,
} from './lib/learning'
import { clearSavedSession, loadSavedSession, saveSavedSession } from './lib/storage'
import type { SessionSnapshot } from './lib/storage'
import type { SolverCallbacks } from './hooks/usePuzzleSolver'
import type { Difficulty, LearningMap, PlacedWord, Puzzle, WordSet } from './types'

type View = 'catalog' | 'set' | 'puzzle' | 'learning'

const EMPTY_SNAPSHOT: SessionSnapshot = {
  entries: {},
  active: null,
  hintsUsed: 0,
  checkMode: false,
}

interface GenerateOptions {
  wordCount: number
  minLength: number
  difficulty: Difficulty
}

export default function App() {
  const [view, setView] = useState<View>('catalog')
  const [selectedSet, setSelectedSet] = useState<WordSet | null>(null)
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [session, setSession] = useState<SessionSnapshot | null>(null)
  const [learning, setLearning] = useState<LearningMap>(() => loadLearning())

  // resume the last unfinished puzzle on first load
  useEffect(() => {
    const saved = loadSavedSession()
    if (saved) {
      setPuzzle(saved.puzzle)
      setSession(saved.snapshot)
      setView('puzzle')
    }
  }, [])

  const learningRef = useRef(learning)
  useEffect(() => {
    learningRef.current = learning
  }, [learning])
  const commitLearning = (next: LearningMap) => {
    learningRef.current = next
    setLearning(next)
    saveLearning(next)
  }

  const setLearningHelpers = (
    word: PlacedWord,
    apply: (m: LearningMap, w: PlacedWord, setSlug: string, setName: string) => LearningMap,
  ) => {
    const set = puzzle ? getWordSetById(puzzle.setSlug) : undefined
    const setSlug = puzzle?.setSlug ?? ''
    const setName = set?.name ?? ''
    commitLearning(apply(learningRef.current, word, setSlug, setName))
  }

  const onWordWorked = (word: PlacedWord) =>
    setLearningHelpers(word, recordWorked)
  const onNewCorrectLetter = (word: PlacedWord) =>
    setLearningHelpers(word, recordCorrect)
  const onWordComplete = (word: PlacedWord) =>
    setLearningHelpers(word, recordCompleted)

  const generate = (set: WordSet, options: GenerateOptions) => {
    const newPuzzle = buildPuzzle(set, {
      wordCount: options.wordCount,
      minLength: options.minLength,
      seed: Date.now(),
      difficulty: options.difficulty,
    })
    setSelectedSet(set)
    setPuzzle(newPuzzle)
    setSession(EMPTY_SNAPSHOT)
    setView('puzzle')
    saveSavedSession({ puzzle: newPuzzle, snapshot: EMPTY_SNAPSHOT, savedAt: Date.now() })
  }

  const handleSessionChange = (snap: SessionSnapshot) => {
    setSession(snap)
    if (puzzle) saveSavedSession({ puzzle, snapshot: snap, savedAt: Date.now() })
  }

  const handleFinished = () => {
    clearSavedSession()
  }

  const openLearning = () => setView('learning')
  const openCatalog = () => setView('catalog')

  const openSetFromLearning = (setSlug: string) => {
    const set = getWordSetById(setSlug)
    if (set) {
      setSelectedSet(set)
      setView('set')
    }
  }

  const learningCallbacks: SolverCallbacks = {
    onWordWorked,
    onNewCorrectLetter,
    onWordComplete,
  }

  const learningCount = Object.keys(learning).length

  const renderNav = (
    <nav className="mt-4 flex gap-2">
      <button
        onClick={openCatalog}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
          view === 'catalog' || view === 'set' || view === 'puzzle'
            ? 'bg-indigo-600 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        Katalog
      </button>
      <button
        onClick={openLearning}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
          view === 'learning'
            ? 'bg-indigo-600 text-white'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        Öğrenme Listem ({learningCount})
      </button>
    </nav>
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Kelime Çengeli</h1>
          <p className="text-sm text-slate-500">
            İngilizce kelime setlerinden otomatik çengel bulmaca üretici
          </p>
          {renderNav}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {view === 'puzzle' && puzzle && (
          <PuzzleView
            key={puzzle.id}
            puzzle={puzzle}
            session={session}
            onSessionChange={handleSessionChange}
            onFinished={handleFinished}
            onBack={openCatalog}
            learning={learningCallbacks}
          />
        )}

        {view === 'set' && selectedSet && (
          <SetDetail
            set={selectedSet}
            onBack={openCatalog}
            onGenerate={options => generate(selectedSet, options)}
          />
        )}

        {view === 'learning' && (
          <LearningView entries={learning} onBack={openCatalog} onOpenSet={openSetFromLearning} />
        )}

        {view === 'catalog' && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Kelime Setleri</h2>
            <SetCatalog
              sets={builtInWordSets}
              onSelect={set => {
                setSelectedSet(set)
                setView('set')
              }}
            />
          </>
        )}
      </main>
    </div>
  )
}