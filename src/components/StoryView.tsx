import { nextStageFor, STORY_CHAPTERS } from '../lib/story'

interface Props {
  storyCleared: number
  onPlay: (stage: number) => void
  onBack: () => void
}

const CHAPTER_TONE: Record<string, string> = {
  A1: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  A2: 'bg-teal-50 border-teal-200 text-teal-700',
  B1: 'bg-amber-50 border-amber-200 text-amber-700',
  B2: 'bg-orange-50 border-orange-200 text-orange-700',
  C1: 'bg-rose-50 border-rose-200 text-rose-700',
  C2: 'bg-purple-50 border-purple-200 text-purple-700',
}

const CHAPTER_ICON: Record<string, string> = {
  A1: '🌱',
  A2: '🌿',
  B1: '🔥',
  B2: '⚡',
  C1: '🌪️',
  C2: '👑',
}

export function StoryView({ storyCleared, onPlay, onBack }: Props) {
  const next = nextStageFor(storyCleared)
  const pct = Math.round((storyCleared / 100) * 100)

  const done = (stage: number) => stage <= storyCleared
  const playable = (stage: number) => stage === next

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
          <div>
            <h2 className="text-xl font-bold text-slate-900">Hikâye Modu</h2>
            <p className="mt-1 text-sm text-slate-500">
              1'den 100'e aşama aşama İngilizce macera. Her aşama bir bulmaca; zorluk ve
              kelime sayısı ilerledikçe artar.
            </p>
          </div>
          <button
            onClick={() => onPlay(next)}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Devam Et → Aşama {next}
          </button>
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{storyCleared}/100 aşama tamamlandı</span>
            <span>%{pct}</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <p className="mt-6 text-sm font-medium text-slate-600">
        İlerlemen: {Math.max(0, storyCleared)} aşama bitirildi · sonraki aşama #{next}
      </p>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {STORY_CHAPTERS.map(chapter => {
          const stages = Array.from(
            { length: chapter.end - chapter.start + 1 },
            (_, i) => chapter.start + i,
          )
          const clearedHere = stages.filter(done).length
          return (
            <div key={chapter.cefr} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="text-lg">{CHAPTER_ICON[chapter.cefr]}</span>
                  {chapter.cefr} · {chapter.label}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${CHAPTER_TONE[chapter.cefr]}`}>
                  {chapter.start}–{chapter.end}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {stages.map(stage => {
                  const isDone = done(stage)
                  const isNext = playable(stage)
                  const locked = !isDone && !isNext
                  return (
                    <button
                      key={stage}
                      type="button"
                      disabled={locked}
                      onClick={() => onPlay(stage)}
                      title={
                        isDone
                          ? `Aşama ${stage} (tamamlandı)`
                          : isNext
                            ? `Aşama ${stage} — oyna`
                            : `Aşama ${stage} (kilitli)`
                      }
                      className={`flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition ${
                        isDone
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : isNext
                            ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                            : 'cursor-not-allowed bg-slate-50 text-slate-300'
                      }`}
                    >
                      {isDone ? '✓' : stage}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2.5 text-xs text-slate-400">
                Bu bölümde {clearedHere}/{stages.length} aşama tamamlandı.
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}