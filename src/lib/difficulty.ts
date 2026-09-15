import type { Difficulty } from '../types'

export const DIFFICULTY_ORDER: Difficulty[] = ['kolay', 'normal', 'zor']

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  kolay: 'Kolay',
  normal: 'Normal',
  zor: 'Zor',
}

export const DIFFICULTY_DESCRIPTION: Record<Difficulty, string> = {
  kolay: 'Bazı harfler önceden dolu, sınırsız ipucu.',
  normal: 'Az sayıda kelimeye birer harf önceden verilir; 10 ipucu, 2 dk’da yenilenir.',
  zor: 'Önceden harf yok; 5 ipucu, 90 sn’de yenilenir.',
}

export type PrefillMode = 'cellPercent' | 'wordTargeted' | 'none'

export interface DifficultyConfig {
  prefill: PrefillMode
  prefillAmount: number
  hintLimit: number
  hintRule80: boolean
  /** ms before a hint charge regenerates; 0 = no regen */
  hintRegenMs: number
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  kolay: { prefill: 'cellPercent', prefillAmount: 0.4, hintLimit: -1, hintRule80: true, hintRegenMs: 0 },
  normal: { prefill: 'wordTargeted', prefillAmount: 0.3, hintLimit: 10, hintRule80: true, hintRegenMs: 120_000 },
  zor: { prefill: 'none', prefillAmount: 0, hintLimit: 5, hintRule80: true, hintRegenMs: 90_000 },
}