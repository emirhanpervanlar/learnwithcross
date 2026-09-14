import { useMemo, useState } from 'react'
import type { WordSet } from '../types'
import { WORD_GROUP_LABELS, WORD_GROUP_ORDER } from '../data/sets'

interface Props {
  sets: WordSet[]
  onSelect: (set: WordSet) => void
}

const sourceLabels: Record<WordSet['source'], string> = {
  oxford: 'Oxford',
  cambridge: 'Cambridge',
  custom: 'Derleme',
  topic: 'Tematik',
}

const levelStyles: Record<string, string> = {
  'A1-A2': 'bg-emerald-50 text-emerald-700',
  'A2-B1': 'bg-sky-50 text-sky-700',
  'B1-B2': 'bg-amber-50 text-amber-700',
  'B2-C1': 'bg-rose-50 text-rose-700',
  'C1-C2': 'bg-rose-50 text-rose-700',
  'A1-B2': 'bg-indigo-50 text-indigo-700',
  'A2-C1': 'bg-purple-50 text-purple-700',
}

const CEFR_LETTERS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const

const tierStyles: Record<string, string> = {
  A1: 'bg-emerald-500',
  A2: 'bg-emerald-500',
  B1: 'bg-amber-500',
  B2: 'bg-amber-500',
  C1: 'bg-rose-500',
  C2: 'bg-rose-500',
}

const setCoversLevel = (level: string | undefined, target: string): boolean => {
  if (!level) return false
  const dash = level.split('-')
  if (dash.length !== 2) return level === target
  const lo = CEFR_LETTERS.indexOf(dash[0] as (typeof CEFR_LETTERS)[number])
  const hi = CEFR_LETTERS.indexOf(dash[1] as (typeof CEFR_LETTERS)[number])
  const t = CEFR_LETTERS.indexOf(target as (typeof CEFR_LETTERS)[number])
  if (lo < 0 || hi < 0 || lo > hi || t < 0) return false
  return t >= lo && t <= hi
}

export function SetCatalog({ sets, onSelect }: Props) {
  const [activeGroup, setActiveGroup] = useState('all')
  const [selectedLevels, setSelectedLevels] = useState<string[]>([])

  const toggleLevel = (level: string) =>
    setSelectedLevels(prev => (prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]))

  const levelFiltered = useMemo(
    () =>
      sets.filter(
        s => selectedLevels.length === 0 || selectedLevels.some(l => setCoversLevel(s.level, l)),
      ),
    [sets, selectedLevels],
  )

  const groupPresent = useMemo(() => {
    const present = new Set(levelFiltered.map(s => s.group))
    return WORD_GROUP_ORDER.filter(g => present.has(g))
  }, [levelFiltered])

  const countInGroup = (g: string) =>
    g === 'all' ? levelFiltered.length : levelFiltered.filter(s => s.group === g).length

  const countForLevel = (level: string) =>
    sets.filter(s => setCoversLevel(s.level, level)).length

  const filtered = useMemo(
    () => (activeGroup === 'all' ? levelFiltered : levelFiltered.filter(s => s.group === activeGroup)),
    [levelFiltered, activeGroup],
  )

  const pill = (id: string, label: string, active: boolean, count: number, activeClass?: string) => (
    <button
      key={id}
      onClick={() => setActiveGroup(id)}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? activeClass ?? 'bg-indigo-600 text-white shadow-sm'
          : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}{' '}
      <span className={`ml-1 text-xs ${active ? 'text-white/60' : 'text-slate-400'}`}>{count}</span>
    </button>
  )

  return (
    <div>
      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {pill('all', 'Tümü', activeGroup === 'all', countInGroup('all'))}
          {groupPresent.map(g =>
            pill(g, WORD_GROUP_LABELS[g] ?? g, activeGroup === g, countInGroup(g)),
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-500">Seviye:</span>
          <button
            onClick={() => setSelectedLevels([])}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              selectedLevels.length === 0
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            Tümü
          </button>
          {CEFR_LETTERS.map(level => {
            const active = selectedLevels.includes(level)
            return (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  active
                    ? `${tierStyles[level]} text-white shadow-sm`
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {level}{' '}
                <span className={`ml-1 text-xs ${active ? 'text-white/60' : 'text-slate-400'}`}>
                  {countForLevel(level)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(set => (
          <button
            key={set.id}
            onClick={() => onSelect(set)}
            className="group rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                  {sourceLabels[set.source]}
                </span>
                {set.group !== 'core' && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {WORD_GROUP_LABELS[set.group] ?? set.group}
                  </span>
                )}
              </span>
              <span className="text-sm font-semibold text-slate-400">{set.words.length} kelime</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">{set.name}</h3>
            {set.level && (
              <span
                className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                  levelStyles[set.level] ?? 'bg-slate-100 text-slate-600'
                }`}
              >
                {set.level}
              </span>
            )}
            <p className="mt-2 text-sm text-slate-500">{set.description}</p>
            <p className="mt-4 text-sm font-medium text-indigo-600 group-hover:underline">Seti aç →</p>
          </button>
        ))}
      </div>
    </div>
  )
}