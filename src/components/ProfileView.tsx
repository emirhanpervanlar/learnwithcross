import type { Achievement } from '../lib/gamification'
import { playerLevelFromXp } from '../lib/gamification'
import type { Profile } from '../lib/gamification'

interface Props {
  profile: Profile
  wordCount: number
  unlocked: Set<string>
  achievements: Achievement[]
  onBack: () => void
}

const STAT_STYLES = [
  ['text-indigo-600', 'bg-indigo-50'],
] as const

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ProfileView({ profile, wordCount, unlocked, achievements, onBack }: Props) {
  const lvl = playerLevelFromXp(profile.xp)
  const unlockedCount = unlocked.size
  const pct = Math.round(lvl.progress * 100)

  const stats: [string, string][] = [
    ['Çözülen Bulmaca', String(profile.puzzlesCompleted)],
    ['Öğrenilen Kelime', String(wordCount)],
    ['Tamamlanan Kelime', String(profile.wordsCompleted)],
    ['Pratik Günü', String(profile.practiceDays.length)],
    ['Zor Bulmaca', String(profile.hardPuzzles)],
    ['İpuçsuz Bulmaca', String(profile.noHintPuzzles)],
    ['Macera Aşaması', String(Math.min(100, profile.storyCleared))],
  ]

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-sm font-medium text-slate-500 transition hover:text-indigo-600"
      >
        ← Kataloğa dön
      </button>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl ${STAT_STYLES[0][1]}`}>
              👤
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{profile.name}</h2>
              <p className="text-sm text-slate-500">
                Üyelik {formatDate(profile.createdAt)} · toplam <span className="font-semibold text-slate-700">{profile.xp} XP</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1 text-sm font-bold text-white">
              Seviye {lvl.level}
            </span>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>
              {lvl.currentXp} XP · Seviye {lvl.level}
            </span>
            <span>
              {lvl.nextXp != null ? `Seviye ${lvl.level + 1}: ${lvl.nextXp} XP` : 'Maksimum seviye'} · %{pct}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Rozet</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {unlockedCount}/100
          </p>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Rozetler <span className="text-slate-400">({unlockedCount}/100)</span>
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {achievements.map(a => {
            const has = unlocked.has(a.id)
            return (
              <div
                key={a.id}
                title={has ? a.description : '🔒 Kilitli'}
                className={`rounded-xl border p-3 text-center transition ${
                  has
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-slate-200 bg-white opacity-60'
                }`}
              >
                <div className={`text-xl ${has ? '' : 'grayscale'}`}>{has ? a.icon : '🔒'}</div>
                <p className={`mt-1 text-xs font-semibold ${has ? 'text-slate-900' : 'text-slate-400'}`}>
                  {has ? a.title : 'Kilitli'}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}