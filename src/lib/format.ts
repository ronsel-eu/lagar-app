/** Numbers and money the way the whole app shows them: a period for thousands (1.248), a comma for decimals. */

const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

/** 1248 -> '1.248' */
export function num(n: number): string {
  return group(String(Math.round(n)))
}

/** 9846 -> '9.846 €'; with 2 decimals, 42 -> '42,00 €'. The space is a non-breaking one. */
export function eur(value: number, decimals = 0): string {
  const [whole, frac] = value.toFixed(decimals).split('.')
  return `${group(whole)}${frac ? ',' + frac : ''} €`
}

/** 2026-10-17 -> 17/10/2026. Anything else is returned as it is. */
export function dmy(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso ?? '')
}

/** The shop's name for a link: its host without "www." (for example bodeboca.com). */
export function shopName(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
