import { useMemo, useState } from 'react'
import type { Difficulty, WordSet } from '../types'
import { DIFFICULTY_DESCRIPTION, DIFFICULTY_LABEL, DIFFICULTY_ORDER } from '../lib/difficulty'
import { WORD_GROUP_LABELS } from '../data/sets'

interface Props {
  set: WordSet
  onBack: () => void
  onGenerate: (options: { wordCount: number; minLength: number; difficulty: Difficulty; questionLanguage?: 'tr' | 'en'; showSynonyms?: boolean }) => void
}

export function SetDetail({ set, onBack, onGenerate }: Props) {
  const [query, setQuery] = useState('')
  const [wordCount, setWordCount] = useState(12)
  const [minLength, setMinLength] = useState(3)
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [questionLanguage, setQuestionLanguage] = useState<'tr' | 'en'>('tr')
  const [showSynonyms, setShowSynonyms] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return set.words
    return set.words.filter(
      w => w.term.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q),
    )
  }, [set.words, query])

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-sm font-medium text-slate-500 transition hover:text-indigo-600"
      >
        ← Kataloğa dön
      </button>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-slate-900">{set.name}</h2>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {WORD_GROUP_LABELS[set.group] ?? set.group}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{set.description}</p>
        <p className="mt-2 text-sm text-slate-400">
          {set.words.length} kelime{set.level ? ` · ${set.level}` : ''}
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Bulmaca Ayarları
        </h3>

        <div className="mt-4">
          <span className="text-sm font-medium text-slate-700">Zorluk seviyesi</span>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {DIFFICULTY_ORDER.map(diff => {
              const active = diff === difficulty
              return (
                <button
                  key={diff}
                  onClick={() => setDifficulty(diff)}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200'
                      : 'border-slate-200 bg-white hover:border-indigo-300'
                  }`}
                >
                  <span className="block font-semibold text-slate-900">
                    {DIFFICULTY_LABEL[diff]}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                    {DIFFICULTY_DESCRIPTION[diff]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Kelime sayısı: <span className="font-semibold text-indigo-600">{wordCount}</span>
            </span>
            <input
              type="range"
              min={6}
              max={20}
              value={wordCount}
              onChange={e => setWordCount(Number(e.target.value))}
              className="mt-2 w-full accent-indigo-600"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Minimum kelime uzunluğu</span>
            <select
              value={minLength}
              onChange={e => setMinLength(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            >
              {[3, 4, 5, 6].map(n => (
                <option key={n} value={n}>
                  {n} harf
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={questionLanguage === 'en'}
              onChange={e => setQuestionLanguage(e.target.checked ? 'en' : 'tr')}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            İngilizce soru
            <span className="ml-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
              +XP
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={showSynonyms}
              onChange={e => setShowSynonyms(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Kolaylaştırıcı bilgi (tür, örnek)
          </label>
        </div>
        <button
          onClick={() => onGenerate({ wordCount, minLength, difficulty, questionLanguage, showSynonyms })}
          className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 sm:w-auto"
        >
          Bulmaca Üret
        </button>
        <p className="mt-2 text-xs text-slate-400">
          {wordCount} kelime örneklenir; ipucu olarak kayıtlı anlamlar kullanılır.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Kelimeler <span className="text-slate-400">({filtered.length})</span>
          </h3>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Kelime veya anlam ara…"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <ul className="nice-scroll mt-4 max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
          {filtered.map((w, i) => (
            <li key={w.term + i} className="flex items-baseline gap-3 py-2.5">
              <span className="w-36 shrink-0 font-semibold text-slate-900">{w.term}</span>
              <span className="text-sm text-slate-500">{w.definition}</span>
              {w.level && (
                <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                  {w.level}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}