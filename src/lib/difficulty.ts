import type { Difficulty } from '../types'

export const DIFFICULTY_ORDER: Difficulty[] = ['kolay', 'normal', 'zor']

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  kolay: 'Kolay',
  normal: 'Normal',
  zor: 'Zor',
}

export const DIFFICULTY_DESCRIPTION: Record<Difficulty, string> = {
  kolay: 'Bazı harfler önceden dolu, ipucu ile harf açılır.',
  normal: 'Az sayıda kelimeye birer harf önceden verilir; sınırlı ipucu.',
  zor: 'Önceden harf yok ve ipucu kullanılamaz.',
}

export type PrefillMode = 'cellPercent' | 'wordTargeted' | 'none'

export interface DifficultyConfig {
  /**
   * how the generator pre-fills letters:
   *  - cellPercent: fills `prefillAmount` of all occupied cells (kolay)
   *  - wordTargeted: gives 1 letter to `prefillAmount` of the words (normal)
   *  - none: no pre-filled letters (zor)
   */
  prefill: PrefillMode
  prefillAmount: number
  /** total hint budget per puzzle; -1 = unlimited */
  hintLimit: number
  /** reveal hints only while the active word is less than 80% filled */
  hintRule80: boolean
}

export const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  kolay: { prefill: 'cellPercent', prefillAmount: 0.4, hintLimit: -1, hintRule80: false },
  normal: { prefill: 'wordTargeted', prefillAmount: 0.3, hintLimit: 3, hintRule80: true },
  zor: { prefill: 'none', prefillAmount: 0, hintLimit: 0, hintRule80: false },
}