import type { Difficulty } from '../types'

// ---------------------------------------------------------------------------
// XP & player level
// ---------------------------------------------------------------------------

const DIFFICULTY_XP_BASE: Record<Difficulty, number> = {
  kolay: 5,
  normal: 8,
  zor: 12,
}

/** Computes total puzzle XP from difficulty, word count, hints used, and English clue bonus. */
export function computePuzzleXp(
  difficulty: Difficulty,
  wordCount: number,
  hintsUsed: number,
  englishClue: boolean,
): number {
  const base = DIFFICULTY_XP_BASE[difficulty] * wordCount
  const hintPenalty = Math.floor(hintsUsed * base * 0.04)
  const englishBonus = englishClue ? Math.floor(base * 0.3) : 0
  return Math.max(10, base - hintPenalty + englishBonus)
}

/** Legacy compat — used by old code paths that need a flat number. */
export const XP_REWARD: Record<Difficulty, number> = {
  kolay: 40,
  normal: 60,
  zor: 90,
}

/** XP required to *reach* a level; plateaus grow quadratically. */
export function xpForLevel(level: number): number {
  return 100 * (level - 1) ** 2
}

/** Bonus XP gained when a vocabulary word climbs to `newLevel`. */
export function wordLevelUpXp(newLevel: number): number {
  return (newLevel - 1) * 10
}

export interface PlayerLevelInfo {
  /** 1-based player level */
  level: number
  /** XP at the start of the current level */
  currentXp: number
  /** XP needed for the next level, or null at cap */
  nextXp: number | null
  /** 0..1 progress toward the next level */
  progress: number
}

export function playerLevelFromXp(xp: number): PlayerLevelInfo {
  const level = Math.floor(Math.sqrt(xp / 100)) + 1
  const currentXp = xpForLevel(level)
  const nextXp = xpForLevel(level + 1)
  const progress = nextXp > currentXp ? (xp - currentXp) / (nextXp - currentXp) : 1
  return {
    level,
    currentXp,
    nextXp,
    progress: Math.min(1, Math.max(0, progress)),
  }
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface Profile {
  name: string
  createdAt: number
  xp: number
  puzzlesCompleted: number
  hardPuzzles: number
  noHintPuzzles: number
  hintsUsed: number
  wordsCompleted: number
  practiceDays: string[]
  storyCleared: number
  storyStarted: boolean
  setCompletions: Record<string, number>
  resumes: number
}

const PROFILE_KEY = 'vocab-crossword:profile'

export function createProfile(name: string): Profile {
  return {
    name: name.trim() || 'Öğrenci',
    createdAt: Date.now(),
    xp: 0,
    puzzlesCompleted: 0,
    hardPuzzles: 0,
    noHintPuzzles: 0,
    hintsUsed: 0,
    wordsCompleted: 0,
    practiceDays: [],
    storyCleared: 0,
    storyStarted: false,
    setCompletions: {},
    resumes: 0,
  }
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Profile
    if (!parsed || typeof parsed !== 'object' || typeof parsed.name !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export function saveProfile(profile: Profile): void {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // ignore storage failures
  }
}

/** Local date in YYYY-MM-DD (used for practice-day tracking). */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function touchPracticeDay(profile: Profile, ts: number = Date.now()): Profile {
  const day = dayKey(ts)
  if (profile.practiceDays.includes(day)) return profile
  return { ...profile, practiceDays: [...profile.practiceDays, day] }
}

export function addXp(profile: Profile, amount: number): Profile {
  return { ...profile, xp: profile.xp + Math.max(0, amount) }
}

// ---------------------------------------------------------------------------
// Achievements — exactly 100: 90 threshold-based + 10 "first" milestones
// ---------------------------------------------------------------------------

export interface Metrics {
  xp: number
  playerLevel: number
  puzzlesCompleted: number
  hardPuzzles: number
  noHintPuzzles: number
  hintsUsed: number
  wordsLearned: number
  wordCompletions: number
  wordsAtMasterMax: number
  practiceDays: number
  storyCleared: number
  resumes: number
  topicSolved: number
  hasProfile: boolean
  storyStarted: boolean
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
}

interface CatalogEntry extends Achievement {
  test: (m: Metrics) => boolean
}

function thresholdFamily(
  prefix: string,
  title: string,
  unit: string,
  icon: string,
  targets: number[],
  val: (m: Metrics) => number,
): CatalogEntry[] {
  return targets.map(
    (t, i): CatalogEntry => ({
      id: `${prefix}-${i + 1}`,
      title: `${title} ${t}${unit}`,
      description: `Bu hedefe ulaş: ${title.toLowerCase()} minimum ${t}${unit}.`,
      icon,
      test: m => val(m) >= t,
    }),
  )
}

const LEVEL_TARGETS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45, 50]
const STORY_TARGETS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75]
const DAYS_TARGETS = [2, 3, 4, 5, 6, 7, 10, 14, 21, 30, 60]
const HARD_TARGETS = [1, 2, 3, 4, 5]
const NOHINT_TARGETS = [1, 2, 3, 4, 5, 6]
const PUZZLE_TARGETS = [1, 3, 5, 10, 20, 30, 50, 75, 100]
const WORDS_TARGETS = [10, 20, 50, 100, 200, 350, 500, 750, 1000]
const COMPLETIONS_TARGETS = [50, 100, 250, 500, 1000, 2000, 3000, 5000, 10000]
const XP_TARGETS = [100, 250, 500, 1000, 2000, 4000, 7500, 15000, 30000]

const TRACKED: CatalogEntry[] = [
  ...thresholdFamily('level', 'Kullanıcı Seviyesi', '', '⭐', LEVEL_TARGETS, m => m.playerLevel),
  ...thresholdFamily('story', 'Macera Aşaması', '', '🗺️', STORY_TARGETS, m => m.storyCleared),
  ...thresholdFamily('days', 'Pratik Günü', '', '📅', DAYS_TARGETS, m => m.practiceDays),
  ...thresholdFamily('hard', 'Zor Bulmaca', '', '🔥', HARD_TARGETS, m => m.hardPuzzles),
  ...thresholdFamily('nohint', 'İpuçsuz Bulmaca', '', '💪', NOHINT_TARGETS, m => m.noHintPuzzles),
  ...thresholdFamily('puzzle', 'Çözülen Bulmaca', '', '🧩', PUZZLE_TARGETS, m => m.puzzlesCompleted),
  ...thresholdFamily('words', 'Öğrenilen Kelime', '', '📖', WORDS_TARGETS, m => m.wordsLearned),
  ...thresholdFamily(
    'completions',
    'Kelime Tamamlama',
    '',
    '✅',
    COMPLETIONS_TARGETS,
    m => m.wordCompletions,
  ),
  ...thresholdFamily('xp', 'Toplam XP', '', '✨', XP_TARGETS, m => m.xp),
]

const FIRSTS: CatalogEntry[] = [
  { ...{ id: 'first-profile', title: 'İlk Adım', description: 'Profilini oluşturdun.', icon: '👋' }, test: m => m.hasProfile },
  { ...{ id: 'first-puzzle', title: 'İlk Bulmaca', description: 'İlk bulmacanı tamamladın.', icon: '🧩' }, test: m => m.puzzlesCompleted >= 1 },
  { ...{ id: 'first-word', title: 'İlk Kelime', description: 'İlk kelimeni öğrenme listene ekledin.', icon: '📖' }, test: m => m.wordsLearned >= 1 },
  { ...{ id: 'first-hint', title: 'İlk İpucu', description: 'İlk ipucunu kullandın.', icon: '💡' }, test: m => m.hintsUsed >= 1 },
  { ...{ id: 'first-levelup', title: 'Seviye Atla', description: 'İlk kullanıcı seviye atlayışını yaptın.', icon: '🚀' }, test: m => m.playerLevel >= 2 },
  { ...{ id: 'first-story', title: 'Macera Başlıyor', description: 'Hikâye moduna ilk adımını attın.', icon: '🗺️' }, test: m => m.storyStarted },
  { ...{ id: 'first-resume', title: 'Geri Dönüş', description: 'Yarım kalan bir bulmacaya geri döndün.', icon: '↩️' }, test: m => m.resumes >= 1 },
  { ...{ id: 'first-topic', title: 'Konu Hâkimi', description: 'İlk tematik setini bitirdin.', icon: '🎯' }, test: m => m.topicSolved >= 1 },
  { ...{ id: 'first-day', title: 'İlk Gün', description: 'Bir gün pratik yaptın.', icon: '🌅' }, test: m => m.practiceDays >= 1 },
  { ...{ id: 'first-master', title: 'Zirve Ustası', description: 'Bir kelimeni en üst ustalık seviyesine taşıdın.', icon: '👑' }, test: m => m.wordsAtMasterMax >= 1 },
]

export const ACHIEVEMENTS: Achievement[] = [...TRACKED, ...FIRSTS]

if (ACHIEVEMENTS.length !== 100) {
  throw new Error(`Achievement catalog must have exactly 100 entries, got ${ACHIEVEMENTS.length}`)
}

/** Returns the ids of every achievement unlocked by the given metrics. */
export function computeUnlocked(metrics: Metrics): string[] {
  return [...TRACKED, ...FIRSTS].filter(a => a.test(metrics)).map(a => a.id)
}