import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ACHIEVEMENTS,
  addXp,
  computeUnlocked,
  createProfile as createProfileObject,
  loadProfile,
  playerLevelFromXp,
  saveProfile,
  touchPracticeDay,
  wordLevelUpXp,
  XP_REWARD,
  type Metrics,
  type Profile,
} from './lib/gamification'
import {
  builtInWordSets,
  buildReviewWords,
  getWordSetById,
  registerExtraSet,
  TOPIC_SET_IDS,
} from './data/sets'
import { buildPuzzle } from './lib/crossword'
import {
  learningKeyFor,
  levelFor,
  loadLearning,
  MASTER_MAX_LEVEL,
  recordCompleted,
  recordCorrect,
  recordWorked,
  saveLearning,
} from './lib/learning'
import { clearSavedSession, loadSavedSession, saveSavedSession } from './lib/storage'
import type { SessionSnapshot } from './lib/storage'
import { buildCefrPools, buildStageWords, stageConfig } from './lib/story'
import { computePuzzleProgress } from './lib/progress'
import { DIFFICULTY_LABEL } from './lib/difficulty'
import type { SolverCallbacks } from './hooks/usePuzzleSolver'
import { LearningView } from './components/LearningView'
import { ProfileView } from './components/ProfileView'
import { PuzzleView } from './components/PuzzleView'
import { SetCatalog } from './components/SetCatalog'
import { SetDetail } from './components/SetDetail'
import { StoryView } from './components/StoryView'
import { WelcomeView } from './components/WelcomeView'
import type { Difficulty, LearningMap, PlacedWord, Puzzle, WordSet } from './types'

type View = 'catalog' | 'set' | 'puzzle' | 'learning' | 'story' | 'profile'
type ReturnView = 'set' | 'story' | 'learning' | 'catalog'

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
  const [profile, setProfile] = useState<Profile | null>(() => loadProfile())
  const [selectedSet, setSelectedSet] = useState<WordSet | null>(null)
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null)
  const [session, setSession] = useState<SessionSnapshot | null>(null)
  const [learning, setLearning] = useState<LearningMap>(() => loadLearning())
  const [puzzleDone, setPuzzleDone] = useState(false)
  const [returnView, setReturnView] = useState<ReturnView>('set')
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null)

  const learningRef = useRef(learning)
  useEffect(() => {
    learningRef.current = learning
  }, [learning])
  const commitLearning = (next: LearningMap) => {
    learningRef.current = next
    setLearning(next)
    saveLearning(next)
  }

  const profileRef = useRef(profile)
  useEffect(() => {
    profileRef.current = profile
  }, [profile])
  const commitProfile = (update: Profile | ((prev: Profile) => Profile)) => {
    const next = typeof update === 'function' ? update(profileRef.current!) : update
    profileRef.current = next
    setProfile(next)
    saveProfile(next)
  }

  // story vocabulary pools (core sets only, grouped by CEFR)
  const storyCoreWords = useMemo(
    () => builtInWordSets.filter(s => s.source === 'oxford' || s.source === 'cambridge').flatMap(s => s.words),
    [],
  )
  const cefrPools = useMemo(() => buildCefrPools(storyCoreWords), [storyCoreWords])
  const storyReviewWords = useMemo(() => buildReviewWords(learning, 120), [learning])

  // achievements + metrics
  const metrics = useMemo<Metrics>(() => {
    const entries = Object.values(learning)
    const wordCompletions = entries.reduce((sum, e) => sum + e.completedCount, 0)
    const wordsAtMasterMax = entries.filter(e => levelFor(e.score).number === MASTER_MAX_LEVEL).length
    const topicSolved = Object.entries(profile?.setCompletions ?? {}).reduce(
      (sum, [slug, n]) => (TOPIC_SET_IDS.has(slug) ? sum + n : sum),
      0,
    )
    const level = profile ? playerLevelFromXp(profile.xp).level : 1
    return {
      xp: profile?.xp ?? 0,
      playerLevel: level,
      puzzlesCompleted: profile?.puzzlesCompleted ?? 0,
      hardPuzzles: profile?.hardPuzzles ?? 0,
      noHintPuzzles: profile?.noHintPuzzles ?? 0,
      hintsUsed: profile?.hintsUsed ?? 0,
      wordsLearned: entries.length,
      wordCompletions,
      wordsAtMasterMax,
      practiceDays: profile?.practiceDays.length ?? 0,
      storyCleared: profile?.storyCleared ?? 0,
      resumes: profile?.resumes ?? 0,
      topicSolved,
      hasProfile: !!profile,
      storyStarted: profile?.storyStarted || (profile?.storyCleared ?? 0) > 0,
    }
  }, [profile, learning])
  const unlocked = useMemo(() => new Set(computeUnlocked(metrics)), [metrics])
  const unlockedCount = unlocked.size

  const handleProfileCreate = (name: string) => {
    commitProfile(createProfileObject(name))
    setView('catalog')
  }

  const requestNav = (fn: () => void) => {
    if (view === 'puzzle' && puzzle && !puzzleDone) {
      setPendingNav(() => fn)
      return
    }
    fn()
  }

  const confirmLeave = () => {
    const fn = pendingNav
    setPendingNav(null)
    clearSavedSession()
    if (fn) fn()
  }

  const openCatalog = () => requestNav(() => setView('catalog'))
  const openLearning = () => requestNav(() => setView('learning'))
  const openStory = () => requestNav(() => setView('story'))
  const openProfile = () => requestNav(() => setView('profile'))

  const openSet = (set: WordSet) =>
    requestNav(() => {
      setSelectedSet(set)
      setView('set')
    })

  const openSetFromLearning = (setSlug: string) => {
    const set = getWordSetById(setSlug)
    if (set) openSet(set)
  }

  const generate = (set: WordSet, options: GenerateOptions, to: ReturnView = 'set') => {
    const newPuzzle = buildPuzzle(set, {
      wordCount: options.wordCount,
      minLength: options.minLength,
      seed: Date.now(),
      difficulty: options.difficulty,
    })
    setSelectedSet(set)
    setPuzzle(newPuzzle)
    setSession(EMPTY_SNAPSHOT)
    setReturnView(to)
    setPuzzleDone(false)
    setView('puzzle')
    saveSavedSession({ puzzle: newPuzzle, snapshot: EMPTY_SNAPSHOT, savedAt: Date.now() })
  }

  const handleSessionChange = (snap: SessionSnapshot) => {
    setSession(snap)
    if (puzzle && !puzzleDone) saveSavedSession({ puzzle, snapshot: snap, savedAt: Date.now() })
  }

  const handleFinished = () => {
    clearSavedSession()
    setPuzzleDone(true)
    const p = profileRef.current
    if (!p) return
    const hints = session?.hintsUsed ?? 0
    let next = touchPracticeDay(p)
    next = addXp(next, XP_REWARD[puzzle!.difficulty])
    if (puzzle!.difficulty === 'zor') next = { ...next, hardPuzzles: next.hardPuzzles + 1 }
    if (hints === 0) next = { ...next, noHintPuzzles: next.noHintPuzzles + 1 }
    next = {
      ...next,
      hintsUsed: next.hintsUsed + hints,
      puzzlesCompleted: next.puzzlesCompleted + 1,
    }
    const slug = puzzle!.setSlug
    next = {
      ...next,
      setCompletions: { ...next.setCompletions, [slug]: (next.setCompletions[slug] ?? 0) + 1 },
    }
    if (slug.startsWith('story-')) {
      const stage = Number(slug.slice('story-'.length))
      if (!Number.isNaN(stage) && stage > next.storyCleared) {
        next = { ...next, storyCleared: stage }
      }
    }
    commitProfile(next)
  }

  const onPuzzleBack = () => {
    requestNav(() => {
      if (returnView === 'story') setView('story')
      else if (returnView === 'learning') setView('learning')
      else if (returnView === 'set' && selectedSet) setView('set')
      else setView('catalog')
    })
  }

  const resumeSaved = () => {
    const saved = loadSavedSession()
    if (!saved) return
    setSelectedSet(getWordSetById(saved.puzzle.setSlug) ?? null)
    setPuzzle(saved.puzzle)
    setSession(saved.snapshot)
    setPuzzleDone(false)
    setReturnView(resolveReturn(saved.puzzle))
    setView('puzzle')
    if (profileRef.current) commitProfile(p => ({ ...p, resumes: p.resumes + 1 }))
  }

  const resolveReturn = (p: Puzzle): ReturnView => {
    if (p.setSlug.startsWith('story-')) return 'story'
    if (p.setSlug === 'review') return 'learning'
    return 'set'
  }

  // --- word learning tracking + XP ---
  const applyWordChange = (
    word: PlacedWord,
    fn: (m: LearningMap, w: PlacedWord, setSlug: string, setName: string) => LearningMap,
  ) => {
    const set = puzzle ? getWordSetById(puzzle.setSlug) : undefined
    const setSlug = puzzle?.setSlug ?? ''
    const setName = set?.name ?? ''
    commitLearning(fn(learningRef.current, word, setSlug, setName))
  }

  const onWordWorked = (word: PlacedWord) => applyWordChange(word, recordWorked)
  const onNewCorrectLetter = (word: PlacedWord) => applyWordChange(word, recordCorrect)

  const onWordComplete = (word: PlacedWord) => {
    const set = puzzle ? getWordSetById(puzzle.setSlug) : undefined
    const setSlug = puzzle?.setSlug ?? ''
    const setName = set?.name ?? ''
    const prevScore = learningRef.current[learningKeyFor(word, setSlug)]?.score ?? 0
    commitLearning(recordCompleted(learningRef.current, word, setSlug, setName))
    const prevLevel = levelFor(prevScore).number
    const nextLevel = levelFor(prevScore + 10).number
    if (nextLevel > prevLevel && profileRef.current) {
      commitProfile(p => addXp(p, wordLevelUpXp(nextLevel)))
    }
    commitProfile(p => ({ ...p, wordsCompleted: p.wordsCompleted + 1 }))
  }

  const learningCallbacks: SolverCallbacks = {
    onWordWorked,
    onNewCorrectLetter,
    onWordComplete,
  }

  // --- special puzzle flows ---
  const openReview = () => {
    const words = buildReviewWords(learning)
    if (words.length < 4) return
    const set: WordSet = {
      id: 'review',
      name: 'Kelimelerimi Pekiştir',
      group: 'core',
      source: 'custom',
      description: 'Öğrendiğin kelimelerden hazırlanan tekrar bulmacası.',
      words,
    }
    registerExtraSet(set)
    generate(
      set,
      {
        wordCount: Math.min(12, Math.max(6, words.length)),
        minLength: 3,
        difficulty: 'normal',
      },
      'learning',
    )
  }

  const playStory = (stage: number) => {
    const cfg = stageConfig(stage)
    const recipe = buildStageWords({ stage, pools: cefrPools, reviewWords: storyReviewWords })
    if (recipe.words.length < 4) return
    const set: WordSet = {
      id: `story-${stage}`,
      name: `Macera · Aşama ${stage} · ${recipe.chapter.cefr}`,
      group: 'core',
      source: 'custom',
      level: recipe.chapter.cefr,
      description: `${recipe.chapter.label} bölümü — ${cfg.wordCount} kelimelik aşama.`,
      words: recipe.words,
    }
    registerExtraSet(set)
    if (profileRef.current && !profileRef.current.storyStarted) {
      commitProfile(p => ({ ...p, storyStarted: true }))
    }
    generate(
      set,
      {
        wordCount: recipe.words.length,
        minLength: cfg.minLength,
        difficulty: recipe.difficulty,
      },
      'story',
    )
  }

  const learningCount = Object.keys(learning).length

  if (!profile) {
    return <WelcomeView onDone={handleProfileCreate} />
  }

  const renderNav = (
    <nav className="mt-4 flex flex-wrap gap-2">
      {(
        [
          ['catalog', 'Katalog', view === 'catalog' || view === 'set' || view === 'puzzle'],
          ['story', 'Macera', view === 'story'],
          ['learning', `Öğrenme Listem (${learningCount})`, view === 'learning'],
          ['profile', `Profilim · Sv.${playerLevelFromXp(profile.xp).level}`, view === 'profile'],
        ] as const
      ).map(([key, label, active]) => (
        <button
          key={key}
          onClick={
            key === 'catalog'
              ? openCatalog
              : key === 'story'
                ? openStory
                : key === 'learning'
                  ? openLearning
                  : openProfile
          }
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            active
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {label}
        </button>
      ))}
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
            onBack={onPuzzleBack}
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
          <LearningView
            entries={learning}
            onBack={openCatalog}
            onOpenSet={openSetFromLearning}
            onReview={openReview}
          />
        )}

        {view === 'story' && (
          <StoryView storyCleared={profile.storyCleared} onPlay={playStory} onBack={openCatalog} />
        )}

        {view === 'profile' && (
          <ProfileView
            profile={profile}
            wordCount={learningCount}
            unlocked={unlocked}
            achievements={ACHIEVEMENTS}
            onBack={openCatalog}
          />
        )}

        {view === 'catalog' && (
          <>
            <ResumeCard onResume={resumeSaved} onDiscard={() => clearSavedSession()} />
            <ProfileCard profile={profile} unlockedCount={unlockedCount} onOpen={openProfile} />
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Kelime Setleri</h2>
            <SetCatalog sets={builtInWordSets} onSelect={openSet} />
          </>
        )}
      </main>

      {pendingNav && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Çıkış onayı"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Bulmaca henüz bitmedi</h3>
            <p className="mt-2 text-sm text-slate-500">
              Çıkarsan bu bulmacadaki ilerlemen bu oturumda silinir (tamamlanan kelimeler öğrenme
              listene işlenmiş olarak kalır). Emin misin?
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setPendingNav(null)}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                Bulmacaya Dön
              </button>
              <button
                onClick={confirmLeave}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-400 hover:text-red-600"
              >
                Çık
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ResumeCard({ onResume, onDiscard }: { onResume: () => void; onDiscard: () => void }) {
  const saved = loadSavedSession()
  if (!saved) return null
  const set = getWordSetById(saved.puzzle.setSlug)
  const progress = computePuzzleProgress(saved.snapshot.entries, saved.puzzle)
  return (
    <div className="mb-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-2xl" aria-hidden="true">
          ⏸️
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Yarım kalan bulmaca: {set?.name ?? saved.puzzle.setSlug}
          </p>
          <p className="text-xs text-slate-500">
            {DIFFICULTY_LABEL[saved.puzzle.difficulty]} · {progress.completedWords}/
            {progress.totalWords} kelime tamamlandı · %{progress.percent}
          </p>
          <div className="mt-1.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full rounded-full bg-amber-500 transition-all"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
        <button
          onClick={onResume}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
        >
          Devam Et (%{progress.percent})
        </button>
        <button
          onClick={onDiscard}
          className="text-xs font-medium text-slate-400 transition hover:text-red-600"
        >
          Sil
        </button>
      </div>
    </div>
  )
}

function ProfileCard({
  profile,
  unlockedCount,
  onOpen,
}: {
  profile: Profile
  unlockedCount: number
  onOpen: () => void
}) {
  const lvl = playerLevelFromXp(profile.xp)
  const pct = Math.round(lvl.progress * 100)
  return (
    <button
      onClick={onOpen}
      className="mb-6 flex w-full flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white">
        {profile.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-900">{profile.name}</span>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
            Seviye {lvl.level}
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="shrink-0 text-right text-sm text-slate-500">
        <p className="font-semibold text-slate-700">{profile.xp} XP</p>
        <p className="text-xs">{unlockedCount}/100 rozet</p>
      </div>
    </button>
  )
}