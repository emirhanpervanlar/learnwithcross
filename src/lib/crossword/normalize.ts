/**
 * Maps Turkish letters to their ASCII equivalents so that a Turkish layout
 * keyboard (ı, ğ, ü, ş, ç, ö) plays nicely with English puzzle answers.
 */
export function latinize(term: string): string {
  return term
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
}

/** Keeps only lowercase a-z letters; used to turn terms into grid letters. */
export function normalizeTerm(term: string): string {
  return latinize(term).toLowerCase().replace(/[^a-z]/g, '')
}