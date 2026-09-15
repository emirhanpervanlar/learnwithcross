import { TR as tr01 } from './tr-parts/tr01'
import { TR as tr02 } from './tr-parts/tr02'
import { TR as tr03 } from './tr-parts/tr03'
import { TR as tr04 } from './tr-parts/tr04'
import { TR as tr05 } from './tr-parts/tr05'
import { TR as tr06 } from './tr-parts/tr06'
import { SYN as st01 } from './syn-parts/syn01'
import { SYN as st02 } from './syn-parts/syn02'
import { SYN as st03 } from './syn-parts/syn03'
import { SYN as st04 } from './syn-parts/syn04'
import { TR as trc01 } from './tr-core/trc01'
import { TR as trc02 } from './tr-core/trc02'
import { TR as trc03 } from './tr-core/trc03'
import { TR as trc04 } from './tr-core/trc04'
import { TR as trc05 } from './tr-core/trc05'
import { TR as trc06 } from './tr-core/trc06'
import { TR as trc07 } from './tr-core/trc07'
import { TR as trc08 } from './tr-core/trc08'
import { TR as trc09 } from './tr-core/trc09'
import { TR as trc10 } from './tr-core/trc10'
import { TR as trc11 } from './tr-core/trc11'
import { TR as trc12 } from './tr-core/trc12'
import { TR as trc13 } from './tr-core/trc13'
import { TR as trc14 } from './tr-core/trc14'
import { TR as trc15 } from './tr-core/trc15'
import { TR as trc16 } from './tr-core/trc16'
import { TR as trc17 } from './tr-core/trc17'
import { TR as trc18 } from './tr-core/trc18'
import { SYN as sync01 } from './syn-core/sync01'
import { SYN as sync02 } from './syn-core/sync02'
import { SYN as sync03 } from './syn-core/sync03'
import { SYN as sync04 } from './syn-core/sync04'
import { SYN as sync05 } from './syn-core/sync05'
import { SYN as sync06 } from './syn-core/sync06'
import { SYN as sync07 } from './syn-core/sync07'
import { SYN as sync08 } from './syn-core/sync08'
import { SYN as sync09 } from './syn-core/sync09'
import { SYN as sync10 } from './syn-core/sync10'
import { SYN as sync11 } from './syn-core/sync11'
import { SYN as sync12 } from './syn-core/sync12'
import { SYN as sync13 } from './syn-core/sync13'
import { SYN as sync14 } from './syn-core/sync14'
import { SYN as sync15 } from './syn-core/sync15'
import { SYN as sync16 } from './syn-core/sync16'
import { SYN as sync17 } from './syn-core/sync17'
import { SYN as sync18 } from './syn-core/sync18'

/** Turkish glosses keyed by normalized (lowercase, punctuation-stripped) English term. */
export const TR_MAP: Record<string, string> = {
  ...trc01,
  ...trc02,
  ...trc03,
  ...trc04,
  ...trc05,
  ...trc06,
  ...trc07,
  ...trc08,
  ...trc09,
  ...trc10,
  ...trc11,
  ...trc12,
  ...trc13,
  ...trc14,
  ...trc15,
  ...trc16,
  ...trc17,
  ...trc18,
  ...tr01,
  ...tr02,
  ...tr03,
  ...tr04,
  ...tr05,
  ...tr06,
}

/** English synonyms keyed by normalized term, as a comma-separated string. */
export const SYN_MAP: Record<string, string> = {
  ...sync01,
  ...sync02,
  ...sync03,
  ...sync04,
  ...sync05,
  ...sync06,
  ...sync07,
  ...sync08,
  ...sync09,
  ...sync10,
  ...sync11,
  ...sync12,
  ...sync13,
  ...sync14,
  ...sync15,
  ...sync16,
  ...sync17,
  ...sync18,
  ...st01,
  ...st02,
  ...st03,
  ...st04,
}

/** Returns a Turkish gloss for a normalized term, or undefined to fall back to English. */
export function lookupTr(normalizedTerm: string): string | undefined {
  return TR_MAP[normalizedTerm]
}

/** Returns a comma-separated synonym string for a normalized term, or undefined. */
export function lookupSyn(normalizedTerm: string): string | undefined {
  return SYN_MAP[normalizedTerm]
}