import { useEffect, useMemo, useState } from 'react'
import type { Achievement } from '../lib/gamification'
import { playerLevelFromXp } from '../lib/gamification'
import { levelFor } from '../lib/learning'

export interface FinishWord {
  id: string
  term: string
  levelFrom: number
  levelTo: number
  leveledUp: boolean
  scoreTo: number
}

export interface FinishData {
  words: FinishWord[]
  xpGained: number
  xpFrom: number
  xpTo: number
  playerFrom: number
  playerTo: number
  playerLeveledUp: boolean
  achievements: Achievement[]
  setName: string
  difficultyLabel: string
  wordCount: number
}

interface Props {
  data: FinishData
  onNewPuzzle: () => void
  onWordList: () => void
}

const CONFETTI_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#3b82f6',
  '#a855f7',
  '#22d3ee',
  '#34d399',
  '#f97316',
  '#ec4899',
]

/** Eased count-up that starts after `delay` ms. */
function useCountUp(target: number, ms: number, delay: number): number {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    const startAt = performance.now() + delay
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - startAt) / ms))
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    const id = window.setTimeout(() => {
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => {
      window.clearTimeout(id)
      cancelAnimationFrame(raf)
    }
  }, [target, ms, delay])
  return value
}

export function GameFinish({ data, onNewPuzzle, onWordList }: Props) {
  const [started, setStarted] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setStarted(true), 80)
    return () => window.clearTimeout(id)
  }, [])

  const xpShown = useCountUp(data.xpGained, 1200, 500)

  const confetti = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.7,
        dur: 2.6 + Math.random() * 2.2,
        size: 6 + Math.random() * 7,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        radius: Math.random() > 0.5 ? '50%' : '2px',
      })),
    [],
  )

  const prevLevel = playerLevelFromXp(data.xpFrom)
  const nextLevel = playerLevelFromXp(data.xpTo)
  const barFrom = prevLevel.progress * 100
  const barTo = nextLevel.progress * 100

  return (
    <div className="relative">
      {/* celebration confetti */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        {confetti.map((p, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: p.radius,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-40 mx-auto max-w-2xl">
        <div className="text-center">
          <div
            className="anim-pop mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-4xl shadow-lg shadow-indigo-300"
            style={{ animationDelay: '0s' }}
          >
            🎉
          </div>
          <h1
            className="anim-rise mt-4 text-3xl font-extrabold tracking-tight text-slate-900"
            style={{ animationDelay: '0.1s' }}
          >
            Tebrikler!
          </h1>
          <p
            className="anim-rise mt-1.5 text-sm text-slate-500"
            style={{ animationDelay: '0.2s' }}
          >
            {data.setName} tamamlandı · {data.difficultyLabel} · {data.wordCount} kelime
          </p>
        </div>

        {/* XP reward */}
        <div
          className="anim-rise mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          style={{ animationDelay: '0.35s' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Kazanılan XP
              </p>
              <p className="text-3xl font-extrabold text-indigo-600">
                +{xpShown} <span className="text-lg font-bold text-slate-400">XP</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                Seviye {data.playerFrom}
              </span>
              <span className="text-slate-400">→</span>
              <span className="rounded-full bg-indigo-600 px-3 py-1 text-sm font-semibold text-white">
                Seviye {data.playerTo}
              </span>
              {data.playerLeveledUp && (
                <span className="anim-bounce-soft rounded-full bg-amber-400 px-3 py-1 text-sm font-bold text-amber-900">
                  Level Up! 🚀
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 transition-all duration-[1400ms] ease-out"
              style={{ width: started ? `${Math.max(barTo, 2)}%` : `${Math.max(barFrom, 2)}%` }}
            />
          </div>
          <p className="mt-1.5 text-right text-xs text-slate-400">
            {data.xpTo.toLocaleString('tr-TR')} XP toplam · {nextLevel.level}. seviyeye{' '}
            {nextLevel.nextXp !== null
              ? `${(nextLevel.nextXp - Math.min(data.xpTo, nextLevel.nextXp)).toLocaleString('tr-TR')} XP`
              : 'maksimum'}{' '}
            kaldı
          </p>
        </div>

        {/* word mastery summary */}
        <div
          className="anim-rise mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          style={{ animationDelay: '0.5s' }}
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Kelime İlerlemesi
          </h2>
          <ul className="mt-3 grid gap-2">
            {data.words.map((w, i) => {
              const lvl = levelFor(w.scoreTo)
              const pct = lvl.progress * 100
              return (
                <li
                  key={w.id}
                  className="anim-rise flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
                  style={{ animationDelay: `${0.55 + i * 0.06}s` }}
                >
                  <span className="w-1/3 min-w-0 truncate text-sm font-bold text-slate-800 sm:w-40">
                    {w.term}
                  </span>
                  {w.leveledUp ? (
                    <span className="anim-pop shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                      Sv{w.levelFrom} → Sv{w.levelTo} · Seviye Atladı
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      Sv{w.levelTo} · {lvl.name}
                    </span>
                  )}
                  <span className="ml-auto hidden sm:block min-w-0 flex-1">
                    <span className="block h-1.5 max-w-40 overflow-hidden rounded-full bg-slate-200">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-[1200ms] ease-out"
                        style={{
                          width: started ? `${Math.max(pct, 3)}%` : '0%',
                          transitionDelay: `${0.55 + i * 0.06}s`,
                        }}
                      />
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        {/* new achievements */}
        {data.achievements.length > 0 && (
          <div
            className="anim-rise mt-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm"
            style={{ animationDelay: `${0.7 + data.words.length * 0.06}s` }}
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-700">
              Yeni Rozetler {data.achievements.length > 1 ? `(+${data.achievements.length})` : ''}
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.achievements.map((a, i) => (
                <div
                  key={a.id}
                  className="anim-pop flex items-start gap-3 rounded-xl border border-amber-200 bg-white p-3 shadow-sm"
                  style={{ animationDelay: `${0.85 + i * 0.15}s` }}
                >
                  <span className="text-2xl" aria-hidden="true">
                    {a.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900">{a.title}</span>
                    <span className="block text-xs text-slate-500">{a.description}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* actions */}
        <div
          className="anim-rise mt-6 flex flex-col gap-3 sm:flex-row"
          style={{ animationDelay: `${0.9 + data.words.length * 0.06}s` }}
        >
          <button
            onClick={onNewPuzzle}
            className="flex-1 rounded-xl bg-indigo-600 px-5 py-3 text-base font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 active:scale-[0.98]"
          >
            Yeni Bulmaca Çöz
          </button>
          <button
            onClick={onWordList}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-bold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600 active:scale-[0.98]"
          >
            Kelimelerim
          </button>
        </div>
      </div>
    </div>
  )
}