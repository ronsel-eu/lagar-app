/** The label band on every page keeps its colour while the app is in use and changes after 30 minutes without use. */
export const BANDS = ['red', 'white', 'rose', 'fortified', 'sparkling'] as const
export type Band = (typeof BANDS)[number]
const KEY = 'lagar_band'
const KEEP_MS = 30 * 60 * 1000

export function pickBand(last: string | null, random: () => number = Math.random): Band {
  const others = BANDS.filter((b) => b !== last)
  return others[Math.floor(random() * others.length)]
}

/** The colour to show now; remembers it (and the time) so the next page keeps it. */
export function currentBand(now = Date.now(), random: () => number = Math.random): Band {
  let last: string | null = null
  let at = 0
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { band: string; at: number } | null
    if (saved) { last = saved.band; at = saved.at }
  } catch { /* no storage: a new colour each time */ }
  const band = BANDS.find((b) => b === last && now - at < KEEP_MS) ?? pickBand(last, random)
  try { localStorage.setItem(KEY, JSON.stringify({ band, at: now })) } catch { /* ignore */ }
  return band
}
