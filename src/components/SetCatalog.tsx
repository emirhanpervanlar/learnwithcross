import type { WordSet } from '../types'

interface Props {
  sets: WordSet[]
  onSelect: (set: WordSet) => void
}

const sourceLabels: Record<WordSet['source'], string> = {
  oxford: 'Oxford',
  cambridge: 'Cambridge',
  custom: 'Derleme',
}

export function SetCatalog({ sets, onSelect }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sets.map(set => (
        <button
          key={set.id}
          onClick={() => onSelect(set)}
          className="group rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
              {sourceLabels[set.source]}
            </span>
            <span className="text-sm font-semibold text-slate-400">{set.words.length} kelime</span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">{set.name}</h3>
          {set.level && (
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">{set.level}</p>
          )}
          <p className="mt-2 text-sm text-slate-500">{set.description}</p>
          <p className="mt-4 text-sm font-medium text-indigo-600 group-hover:underline">Seti aç →</p>
        </button>
      ))}
    </div>
  )
}