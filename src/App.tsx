import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ACHIEVEMENTS,
  addXp,
  computePuzzleXp,
  computeUnlocked,
  createProfile as createProfileObject,
  loadProfile,
  playerLevelFromXp,
  saveProfile,
  touchPracticeDay,
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
  saveLearning,
} from './lib/learning'
import { clearSavedSession, loadSavedSession, saveSavedSession } from './lib/storage'
import type { SessionSnapshot } from './lib/storage'
import { buildCefrPools, buildStageWords, stageConfig } from './lib/story'
import { computePuzzleProgress } from './lib/progress'
import { DIFFICULTY_CONFIG, DIFFICULTY_LABEL } from './lib/difficulty'
import { LearningView } from './components/LearningView'
import { ProfileView } from './components/ProfileView'
import { PuzzleView } from './components/PuzzleView'
import { SetCatalog } from './components/SetCatalog'
import { SetDetail } from './components/SetDetail'
import { StoryView } from './components/StoryView'
import { WelcomeView } from './components/WelcomeView'
import { GameFinish, type FinishData } from './components/GameFinish'
import type { Difficulty, LearningMap, PlacedWord, Puzzle, WordSet } from './types'

type View = 'catalog' | 'set' | 'puzzle' | 'learning' | 'story' | 'profile' | 'finish'
type ReturnView = 'set' | 'story' | 'learning' | 'catalog'

const EMPTY_SNAPSHOT: SessionSnapshot = {
  entries: {},
  active: null,
  hintsUsed: 0,
  checkMode: false,
}

function computeMetricsFor(profile: Profile | null, learning: LearningMap): Metrics {
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
}

interface GenerateOptions {
  wordCount: number
  minLength: number
  difficulty: Difficulty
  questionLanguage?: 'tr' | 'en'
  showSynonyms?: boolean
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
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
  )
  const [finishData, setFinishData] = useState<FinishData | null>(null)
  const [puzzleWordsStart, setPuzzleWordsStart] = useState<Map<string, number>>(new Map())
  const [toasts, setToasts] = useState<{ key: string; icon: string; title: string }[]>([])
  const completedWordsRef = useRef<Map<string, { score: number; level: number }>>(new Map())

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const apply = () => setIsMobile(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (view !== 'puzzle') return
    const handler = (e: PopStateEvent) => {
      e.preventDefault()
      history.pushState(null, '', location.href)
    }
    history.pushState(null, '', location.href)
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [view])

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
  const metrics = useMemo<Metrics>(() => computeMetricsFor(profile, learning), [profile, learning])
  const unlocked = useMemo(() => new Set(computeUnlocked(metrics)), [metrics])
  const unlockedCount = unlocked.size

  // toast newly unlocked achievements while playing (not re-shown on the finish screen)
  const prevUnlockedRef = useRef<Set<string> | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view
  useEffect(() => {
    const prev = prevUnlockedRef.current
    if (prev === null) {
      prevUnlockedRef.current = unlocked
      return
    }
    if (viewRef.current === 'finish') {
      prevUnlockedRef.current = unlocked
      return
    }
    const discovered = ACHIEVEMENTS.filter(a => !prev.has(a.id) && unlocked.has(a.id))
    if (discovered.length > 0) {
      const items = discovered.map(a => ({
        key: `${a.id}-${Date.now()}-${Math.random()}`,
        icon: a.icon,
        title: a.title,
      }))
      setToasts(prevToasts => [...prevToasts, ...items])
      items.forEach((it, i) => {
        window.setTimeout(() => {
          setToasts(prevToasts => prevToasts.filter(t => t.key !== it.key))
        }, 4200 + i * 500)
      })
    }
    prevUnlockedRef.current = unlocked
  }, [unlocked])

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
      questionLanguage: options.questionLanguage,
      showSynonyms: options.showSynonyms,
    })
    setSelectedSet(set)
    setPuzzle(newPuzzle)
    setSession(EMPTY_SNAPSHOT)
    setReturnView(to)
    setPuzzleDone(false)
    setFinishData(null)
    setPuzzleWordsStart(
      new Map(
        newPuzzle.words.map(w => [
          w.id,
          learningRef.current[learningKeyFor(w, set.id)]?.score ?? 0,
        ]),
      ),
    )
    setView('puzzle')
    saveSavedSession({ puzzle: newPuzzle, snapshot: EMPTY_SNAPSHOT, savedAt: Date.now() })
  }

  const handleSessionChange = (snap: SessionSnapshot) => {
    setSession(snap)
    if (puzzle && !puzzleDone) saveSavedSession({ puzzle, snapshot: snap, savedAt: Date.now() })
  }

  const handleFinished = (snapshot: SessionSnapshot) => {
    clearSavedSession()
    setPuzzleDone(true)
    const p = profileRef.current
    if (!p) return
    const hints = snapshot.hintsUsed
    const pz = puzzle!
    const actualSet = getWordSetById(pz.setSlug)
    const setName = actualSet?.name ?? pz.setSlug
    const xpGained = computePuzzleXp(pz.difficulty, pz.words.length, hints, pz.questionLanguage === 'en')

    // deferred scoring: apply fixed points per completed word at finish (no learning writes during play)
    const entries = snapshot.entries
    const isWordCompleted = (word: PlacedWord): boolean => {
      for (let i = 0; i < word.length; i++) {
        const row = word.row + (word.dir === 'down' ? i : 0)
        const col = word.col + (word.dir === 'across' ? i : 0)
        if (entries[`${row},${col}`] !== word.letters[i]) return false
      }
      return true
    }
    const updated: LearningMap = { ...learningRef.current }
    const wordLevelUps = new Map<string, { oldLevel: number; newLevel: number }>()
    const wordXp = new Map<string, number>() // per-word mastery XP for completed words
    let wordXpTotal = 0
    let completedWordCount = 0
    for (const word of pz.words) {
      if (!isWordCompleted(word)) continue
      completedWordCount++
      const key = learningKeyFor(word, pz.setSlug)
      const prev = updated[key]
      const score = Math.max(3, word.letters.length)
      const oldLevel = levelFor(prev?.score ?? 0).number
      const newScore = (prev?.score ?? 0) + score
      const newLevel = levelFor(newScore).number
      updated[key] = {
        wordId: key,
        wordText: word.display,
        setSlug: pz.setSlug,
        setName,
        score: newScore,
        completedCount: (prev?.completedCount ?? 0) + 1,
        lastWorkedAt: Date.now(),
      }
      wordLevelUps.set(key, { oldLevel, newLevel })
      wordXp.set(key, score)
      wordXpTotal += score
      completedWordsRef.current.set(word.id, { score: newScore, level: newLevel })
    }
    commitLearning(updated)

    let next = touchPracticeDay(p)
    next = addXp(next, xpGained + wordXpTotal)
    if (pz.difficulty === 'zor') next = { ...next, hardPuzzles: next.hardPuzzles + 1 }
    if (hints === 0) next = { ...next, noHintPuzzles: next.noHintPuzzles + 1 }
    next = {
      ...next,
      hintsUsed: next.hintsUsed + hints,
      puzzlesCompleted: next.puzzlesCompleted + 1,
      wordsCompleted: next.wordsCompleted + completedWordCount,
    }
    const slug = pz.setSlug
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

    // --- build the celebration payload ---
    const prevLvl = playerLevelFromXp(p.xp)
    const afterLvl = playerLevelFromXp(next.xp)
    const beforeIds = new Set(computeUnlocked(computeMetricsFor(p, learningRef.current)))
    const afterIds = new Set(computeUnlocked(computeMetricsFor(next, learningRef.current)))
    const newAchievements = ACHIEVEMENTS.filter(a => !beforeIds.has(a.id) && afterIds.has(a.id))
    const startScores = puzzleWordsStart
    const wordEvents: FinishData['words'] = pz.words.map(w => {
      const key = learningKeyFor(w, pz.setSlug)
      const up = wordLevelUps.get(key)
      const after = updated[key]?.score ?? 0
      const before = startScores.get(w.id) ?? 0
      return {
        id: w.id,
        term: w.display,
        levelFrom: up?.oldLevel ?? levelFor(before).number,
        levelTo: up?.newLevel ?? levelFor(after).number,
        leveledUp: (up?.newLevel ?? levelFor(after).number) > (up?.oldLevel ?? levelFor(before).number),
        scoreTo: after,
        xp: wordXp.get(key) ?? 0,
      }
    })
    setFinishData({
      words: wordEvents,
      xpGained: next.xp - p.xp,
      xpFrom: p.xp,
      xpTo: next.xp,
      playerFrom: prevLvl.level,
      playerTo: afterLvl.level,
      playerLeveledUp: afterLvl.level > prevLvl.level,
      achievements: newAchievements,
      setName,
      difficultyLabel: DIFFICULTY_LABEL[pz.difficulty],
      wordCount: pz.words.length,
    })
    setView('finish')
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
    setFinishData(null)
    setReturnView(resolveReturn(saved.puzzle))
    setPuzzleWordsStart(
      new Map(
        saved.puzzle.words.map(w => [
          w.id,
          learningRef.current[learningKeyFor(w, saved.puzzle.setSlug)]?.score ?? 0,
        ]),
      ),
    )
    setView('puzzle')
    if (profileRef.current) commitProfile(p => ({ ...p, resumes: p.resumes + 1 }))
  }

  const resolveReturn = (p: Puzzle): ReturnView => {
    if (p.setSlug.startsWith('story-')) return 'story'
    if (p.setSlug === 'review') return 'learning'
    return 'set'
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

  const puzzleViewEl =
    view === 'puzzle' && puzzle ? (
      <PuzzleView
        key={puzzle.id}
        puzzle={puzzle}
        session={session}
        onSessionChange={handleSessionChange}
        onFinished={handleFinished}
        onBack={onPuzzleBack}
      />
    ) : null

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {view === 'puzzle' && puzzle && isMobile ? (
        <MobilePuzzleShell onClose={onPuzzleBack}>{puzzleViewEl}</MobilePuzzleShell>
      ) : (
        <>
          {!(view === 'finish' && isMobile) && (
            <header className="border-b border-slate-200 bg-white">
              <div className="mx-auto max-w-6xl px-4 py-5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Kelime Çengeli</h1>
                <p className="text-sm text-slate-500">
                  İngilizce kelime setlerinden otomatik çengel bulmaca üretici
                </p>
                {renderNav}
              </div>
            </header>
          )}
          <main className="mx-auto max-w-6xl px-4 py-8">
            {puzzleViewEl}

            {view === 'finish' && finishData && (
              <GameFinish
                data={finishData}
                onHome={openCatalog}
                onWordList={openLearning}
                onContinueStory={
                  returnView === 'story'
                    ? () => {
                        setView('story')
                        setFinishData(null)
                      }
                    : undefined
                }
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
        </>
      )}

      {toasts.length > 0 && (
        <div className="pointer-events-none fixed left-1/2 top-3 z-[70] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
          {toasts.map(t => (
            <div
              key={t.key}
              className="anim-toast pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-emerald-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur"
            >
              <span className="text-xl" aria-hidden="true">
                {t.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Yeni rozet kazandın!
                </p>
                <p className="truncate text-sm font-bold text-slate-900">{t.title}</p>
              </div>
            </div>
          ))}
        </div>
      )}

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
            {DIFFICULTY_LABEL[saved.puzzle.difficulty]} ·{' '}
            {DIFFICULTY_CONFIG[saved.puzzle.difficulty].hintLimit < 0
              ? 'sınırsız ipucu'
              : `${DIFFICULTY_CONFIG[saved.puzzle.difficulty].hintLimit} ipucu`}{' '}
            · {progress.completedWords}/{progress.totalWords} kelime tamamlandı · %{progress.percent}
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

function MobilePuzzleShell({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-50">
      <div className="z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-sm font-bold text-slate-900">Bulmaca</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Bulmacadan çık"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-24 pt-1">{children}</div>
    </div>
  )
}