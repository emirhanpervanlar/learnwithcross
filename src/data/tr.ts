import { TR as tr01 } from './tr-parts/tr01'
import { TR as tr02 } from './tr-parts/tr02'
import { TR as tr03 } from './tr-parts/tr03'
import { TR as tr04 } from './tr-parts/tr04'
import { TR as tr05 } from './tr-parts/tr05'
import { TR as tr06 } from './tr-parts/tr06'

/** Turkish glosses keyed by normalized (lowercase, punctuation-stripped) English term. */
export const TR_MAP: Record<string, string> = {
  ...tr01,
  ...tr02,
  ...tr03,
  ...tr04,
  ...tr05,
  ...tr06,
}

/** Returns a Turkish gloss for a normalized term, or undefined to fall back to English. */
export function lookupTr(normalizedTerm: string): string | undefined {
  return TR_MAP[normalizedTerm]
}