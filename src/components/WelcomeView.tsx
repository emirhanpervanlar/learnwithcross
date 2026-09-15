import { useState } from 'react'
import type { FormEvent } from 'react'

interface Props {
  onDone: (name: string) => void
}

export function WelcomeView({ onDone }: Props) {
  const [name, setName] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onDone(name)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="anim-rise w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl">
          🧩
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Kelime Çengeli</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Hoş geldin! İngilizce kelimelerle çengel bulmaca çöz, XP kazan, seviye atla ve
          macerayı aşama aşama tamamla.
        </p>

        <form onSubmit={submit} className="mt-6">
          <label className="block text-left">
            <span className="text-sm font-medium text-slate-700">Adın ne?</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Örn. Ada"
              autoFocus
              maxLength={30}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            Başla
          </button>
          <p className="mt-3 text-xs text-slate-400">
            Profil, XP ve öğrenme listen tarayıcıda saklanır.
          </p>
        </form>
      </div>
    </div>
  )
}