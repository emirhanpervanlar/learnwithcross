import type { LearningEntry, LearningMap } from '../types'
import { levelFor } from '../lib/learning'

interface Props {
  entries: LearningMap
  onBack: () => void
  onOpenSet: (setSlug: string) => void
  onReview: () => void
}

const LEVEL_TONES: Record<number, string> = {
  1: 'bg-slate-100 text-slate-600',
  2: 'bg-sky-50 text-sky-700',
  3: 'bg-indigo-50 text-indigo-700',
  4: 'bg-violet-100 text-violet-700',
  5: 'bg-amber-100 text-amber-800',
  6: 'bg-orange-100 text-orange-800',
  7: 'bg-rose-100 text-rose-800',
  8: 'bg-fuchsia-100 text-fuchsia-800',
  9: 'bg-purple-100 text-purple-800',
  10: 'bg-slate-800 text-white',
}

function formatDate(ts: number): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function LearningView({ entries, onBack, onOpenSet, onReview }: Props) {
  const list: LearningEntry[] = Object.values(entries).sort(
    (a, b) => b.score - a.score || b.lastWorkedAt - a.lastWorkedAt,
  )

  const totalScore = list.reduce((sum, e) => sum + e.score, 0)
  const completedTotal = list.reduce((sum, e) => sum + e.completedCount, 0)
  const canReview = list.length >= 4

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-sm font-medium text-slate-500 transition hover:text-indigo-600"
      >
        ← Kataloğa dön
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Öğrenme Listem</h2>
          <p className="mt-1 text-sm text-slate-500">
            Bulmaca çözdükçe kelimelerin öğrenme puanını burada takip edebilirsin.
          </p>
        </div>
        <button
          onClick={onReview}
          disabled={!canReview}
          title={canReview ? undefined : 'En az 4 kelime öğrenmeden pekiştirme bulmacası açılmaz.'}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            canReview
              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
              : 'cursor-not-allowed bg-slate-100 text-slate-400'
          }`}
        >
          Kelimelerimi Pekiştir
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Çalışılan kelime" value={String(list.length)} />
        <StatCard label="Toplam puan" value={String(totalScore)} />
        <StatCard label="Tamamlanan kelime" value={String(completedTotal)} />
      </div>

      {list.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-slate-600">
            Henüz çalışılan kelime yok.
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Bir bulmaca çözdükçe üzerinde çalıştığın kelimeler ve puanları burada görünür.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {list.map(entry => {
            const lvl = levelFor(entry.score)
            const pct = Math.round(lvl.progress * 100)
            return (
              <li key={entry.wordId}>
                <button
                  onClick={() => onOpenSet(entry.setSlug)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-left transition hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{entry.wordText}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL_TONES[lvl.number] ?? LEVEL_TONES[1]}`}
                      >
                        Sv.{lvl.number} · {lvl.name}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">{entry.setName}</p>
                  </div>

                  <div className="w-full font-semibold text-indigo-600 sm:w-24 sm:text-right">
                    {entry.score} puan
                  </div>

                  <div className="hidden w-36 sm:block">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{lvl.nextAt != null ? `Sv.${lvl.number + 1}` : 'Maks'}</span>
                      <span>%{pct}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="w-full text-xs text-slate-400 sm:w-auto sm:text-right">
                    {entry.completedCount > 0 && `${entry.completedCount} kez çözüldü · `}
                    Son çalışma {formatDate(entry.lastWorkedAt)}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}