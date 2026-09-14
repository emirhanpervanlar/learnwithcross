/** Keeps only lowercase a-z letters; used to turn terms into grid letters. */
export function normalizeTerm(term: string): string {
  return term.toLowerCase().replace(/[^a-z]/g, '')
}