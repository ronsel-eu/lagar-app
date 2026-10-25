/**
 * What the Home and Wines screens show: one row per wine and vintage, the filters with their counts, the order, and
 * the random picks on Home. A port of wine_list / browse / home_picks / home_stats of the original Lagar (app/db.py).
 * Everything here is a pure function of the wines, the opened bottles, the year and a random source.
 */
import { adviceFor, type Status } from './advice/engine'
import type { OpenedBottle, Vintage, Wine, WineType } from './types'

export type State = 'present' | 'opened' | 'both'
export type Sort = 'recent' | 'oldest' | 'price_high' | 'price_low' | 'points'
export type Tag = 'now' | 'soon' | 'young' | ''

export const STATES: Record<State, string> = { present: 'In my cellar', opened: 'Opened', both: 'Both' }
export const SORTS: Record<Sort, string> = {
  recent: 'Newest purchase', oldest: 'Oldest purchase', price_high: 'Price: high to low', price_low: 'Price: low to high', points: 'Critic points',
}
export const STATUS_LABEL: Record<Status, string> = {
  drink_now: 'Drink now', drink_soon: 'Drink soon', can_wait: 'Can wait', keep: 'Keep', evolves: 'Evolves',
}
export const FILTER_FIELDS = ['country', 'region', 'appellation', 'colour', 'grape', 'year'] as const
export type FilterField = (typeof FILTER_FIELDS)[number]
export type Selection = Record<FilterField, string>

/** One wine as the lists show it. */
export interface Row {
  id: string
  name: string
  type: WineType | null
  producer: string | null
  country: string | null
  region: string | null
  appellation: string | null
  vintage: Vintage
  /** Price paid per bottle. */
  price: number | null
  /** The best critic score in points. */
  points: number | null
  bottles: number
  /** Bottles of this wine that have been opened. */
  openedN: number
  purchaseDate: string | null
  status: Status
  grapes: string[]
  tag: Tag
}

const YOUNG_YEARS = 4

// ---------------------------------------------------------------- grapes

/** Text without accents, lower case. */
export function fold(text: string | null | undefined): string {
  return (text ?? '').normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase().trim()
}

// Different names for the same variety: the key is merged into the value in the grape filter.
const GRAPE_ALIASES: Record<string, string> = { palomino: 'Palomino fino' }
const NOT_A_GRAPE = new Set(['autres', 'autre', 'otras', 'otros', 'outras', 'outros', 'others', 'other', 'varias'])

/** '60% Garnacha, 15% Monastrell, 25% Autres' -> ['Garnacha', 'Monastrell']. One entry per variety. */
export function parseGrapes(text: string | null | undefined): string[] {
  const out: string[] = []
  for (const part of (text ?? '').split(/,(?!\d)|\s+(?:et|and)\s+/)) {
    const name = part.replace(/^\s*\d+(?:[.,]\d+)?\s*%\s*/, '').replace(/^[ .]+|[ .]+$/g, '')
    if (!/[\p{L}]/u.test(name) || NOT_A_GRAPE.has(fold(name))) continue
    const merged = GRAPE_ALIASES[fold(name)] ?? name
    const canon = merged[0].toUpperCase() + merged.slice(1)
    if (!out.includes(canon)) out.push(canon)
  }
  return out
}

// ---------------------------------------------------------------- the rows

export function toRows(wines: Wine[], opened: OpenedBottle[], year: number): Row[] {
  const openedBy = new Map<string, number>()
  for (const o of opened) openedBy.set(o.wineId, (openedBy.get(o.wineId) ?? 0) + o.qty)
  return wines.map((w) => ({
    id: w.id, name: w.name, type: w.type, producer: w.producer, country: w.country, region: w.region,
    appellation: w.appellation, vintage: w.vintage, price: w.paid, points: w.criticPoints, bottles: w.bottles, openedN: openedBy.get(w.id) ?? 0,
    purchaseDate: w.purchaseDate, status: adviceFor(w, year).status, grapes: parseGrapes(w.grapes), tag: '',
  }))
}

const nameKey = (r: Row) => fold(r.name).replace(/^[ '"]+/, '')
export const byName = (a: Row, b: Row) => (nameKey(a) < nameKey(b) ? -1 : nameKey(a) > nameKey(b) ? 1 : 0)

/** Missing values always go last. Ties are broken by name. */
export function sortRows(rows: Row[], sort: Sort): Row[] {
  const missingLast = <T,>(value: (r: Row) => T | null, desc: boolean) => {
    const have = rows.filter((r) => value(r) !== null && value(r) !== 0)
    const none = rows.filter((r) => value(r) === null || value(r) === 0)
    have.sort((a, b) => {
      const x = value(a)!
      const y = value(b)!
      const c = x < y ? -1 : x > y ? 1 : 0
      return c !== 0 ? (desc ? -c : c) : byName(a, b)
    })
    return [...have, ...none.sort(byName)]
  }
  if (sort === 'recent') return missingLast((r) => r.purchaseDate || null, true)
  if (sort === 'oldest') return missingLast((r) => r.purchaseDate || null, false)
  if (sort === 'points') return missingLast((r) => r.points, true)
  if (sort === 'price_high') return missingLast((r) => r.price, true)
  return missingLast((r) => r.price, false)
}

// ---------------------------------------------------------------- the Wines page

const valuesOf = (r: Row, field: FilterField): string[] => {
  if (field === 'grape') return r.grapes
  if (field === 'year') return r.vintage === 'NV' ? ['nv'] : r.vintage ? [String(r.vintage)] : []
  if (field === 'colour') return r.type ? [r.type] : []
  const v = r[field]
  return v ? [v] : []
}

export interface Option { value: string; label: string; count: number }

export interface Browse {
  rows: Row[]
  options: Record<FilterField, Option[]>
  selection: Selection
  state: State
  sort: Sort
  status: Status | ''
  /** How many wines each drinking status gives with the other choices as they are (0 = nothing to show). */
  statusCounts: Record<Status, number>
  bottles: number
}

export const emptySelection = (): Selection => ({ country: '', region: '', appellation: '', colour: '', grape: '', year: '' })

const isState = (s: string): s is State => Object.hasOwn(STATES, s)
const isSort = (s: string): s is Sort => Object.hasOwn(SORTS, s)
const isStatus = (s: string): s is Status => Object.hasOwn(STATUS_LABEL, s)

/** The wines that match, and for every filter the choices that still make sense given the others, each with how many
 *  wines it gives. The drinking status is one more filter of the same kind: choosing it never clears the others, and a
 *  status that would give no wines is counted as 0 (the screen does not let you pick it). A selected choice that no
 *  longer fits the others is dropped. */
export function browse(all: Row[], input: { state?: string; sort?: string; status?: string; selection?: Partial<Selection> }): Browse {
  const state: State = isState(input.state ?? '') ? (input.state as State) : 'present'
  const sort: Sort = isSort(input.sort ?? '') ? (input.sort as Sort) : 'recent'
  let status: Status | '' = isStatus(input.status ?? '') ? (input.status as Status) : ''
  const keep: Record<State, (r: Row) => boolean> = {
    present: (r) => r.bottles > 0,
    opened: (r) => r.openedN > 0,
    both: (r) => r.bottles > 0 || r.openedN > 0,
  }
  const base = sortRows(all.filter((r) => keep[state](r)), sort)
  const selection = { ...emptySelection(), ...input.selection }
  const fits = (r: Row, skip: FilterField | 'status' | null) =>
    (skip === 'status' || !status || r.status === status) &&
    FILTER_FIELDS.every((f) => f === skip || !selection[f] || valuesOf(r, f).includes(selection[f]))

  const counts = {} as Record<FilterField, Map<string, number>>
  const statusCounts = Object.fromEntries(Object.keys(STATUS_LABEL).map((k) => [k, 0])) as Record<Status, number>
  for (let pass = 0; pass < 2; pass++) {
    for (const k of Object.keys(statusCounts) as Status[]) statusCounts[k] = 0
    for (const r of base) if (fits(r, 'status')) statusCounts[r.status]++
    if (status && !statusCounts[status]) status = ''
    for (const f of FILTER_FIELDS) {
      const c = new Map<string, number>()
      for (const r of base) if (fits(r, f)) for (const v of valuesOf(r, f)) c.set(v, (c.get(v) ?? 0) + 1)
      counts[f] = c
      if (selection[f] && !c.has(selection[f])) selection[f] = ''
    }
  }
  const options = {} as Record<FilterField, Option[]>
  for (const f of FILTER_FIELDS) {
    const c = counts[f]
    const keys = [...c.keys()]
    const label = (k: string) => (f === 'year' ? (k === 'nv' ? 'NV' : k) : f === 'colour' ? k[0].toUpperCase() + k.slice(1) : k)
    if (f === 'year') keys.sort((a, b) => (a === 'nv' ? 1 : b === 'nv' ? -1 : Number(b) - Number(a)))
    else if (f === 'country' || f === 'colour') keys.sort((a, b) => c.get(b)! - c.get(a)! || (fold(a) < fold(b) ? -1 : 1))
    else keys.sort((a, b) => (fold(a) < fold(b) ? -1 : fold(a) > fold(b) ? 1 : 0))
    options[f] = keys.map((k) => ({ value: k, label: label(k), count: c.get(k)! }))
  }
  const rows = base.filter((r) => fits(r, null))
  return { rows, options, selection, state, sort, status, statusCounts, bottles: rows.reduce((n, r) => n + r.bottles, 0) }
}

// ---------------------------------------------------------------- Home

export interface Stats {
  bottles: number
  wines: number
  drinkNow: number
  /** Bottles x price paid, for the wines that have a price. */
  cost: number
  /** Wines in the cellar with no known price (they are not valued at 0). */
  unpriced: number
  /** The cellar has no wines at all. */
  empty: boolean
}

export function homeStats(all: Row[]): Stats {
  const owned = all.filter((r) => r.bottles > 0)
  const priced = owned.filter((r) => r.price !== null)
  return {
    bottles: owned.reduce((n, r) => n + r.bottles, 0),
    wines: owned.length,
    drinkNow: owned.filter((r) => r.status === 'drink_now').length,
    cost: priced.reduce((n, r) => n + r.bottles * r.price!, 0),
    unpriced: owned.length - priced.length,
    empty: all.length === 0,
  }
}

export interface Picks { red: Row[]; white: Row[]; now: Row[] }

type Rng = () => number

const choice = <T,>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)]
function shuffled<T>(items: T[], rng: Rng): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Suggestions: 3 red and 3 white, each colour with one drink now, one drink soon and one young wine (when there is one),
 *  filled up with others. Drink now: 2 red and 1 white. All random, so they change every time the app is used. */
export function homePicks(all: Row[], year: number, rng: Rng = Math.random): Picks {
  const base = all.filter((r) => r.bottles > 0)
  const youngFrom = year - YOUNG_YEARS

  const suggestions = (type: WineType): Row[] => {
    const pool = base.filter((r) => r.type === type)
    const chosen: Row[] = []
    const take = (rule: (r: Row) => boolean, tag: Tag) => {
      const cands = pool.filter((r) => rule(r) && !chosen.some((c) => c.id === r.id))
      if (cands.length) chosen.push({ ...choice(cands, rng), tag })
    }
    take((r) => r.status === 'drink_now', 'now')
    take((r) => r.status === 'drink_soon', 'soon')
    take((r) => r.vintage !== 'NV' && r.vintage >= youngFrom && r.status !== 'drink_now', 'young')
    const rest = shuffled(pool.filter((r) => !chosen.some((c) => c.id === r.id)), rng)
    return [...chosen, ...rest.slice(0, 3 - chosen.length).map((r) => ({ ...r, tag: '' as Tag }))]
  }

  const nowPool = base.filter((r) => r.status === 'drink_now')
  const red = nowPool.filter((r) => r.type === 'red')
  const white = nowPool.filter((r) => r.type === 'white')
  const other = nowPool.filter((r) => r.type !== 'red' && r.type !== 'white')
  const now = [...shuffled(red, rng).slice(0, 2), ...shuffled(white, rng).slice(0, 1)]
  const spare = shuffled([...red, ...white, ...other].filter((r) => !now.includes(r)), rng)
  now.push(...spare.slice(0, 3 - now.length))
  return { red: suggestions('red'), white: suggestions('white'), now }
}

/** Home search: only wines still in the cellar; name, producer, region, appellation or grapes contain the text. */
export function searchCellar(all: Row[], wines: Wine[], q: string): Row[] {
  const needle = fold(q)
  if (!needle) return []
  const byId = new Map(wines.map((w) => [w.id, w]))
  return all
    .filter((r) => {
      if (r.bottles <= 0) return false
      const w = byId.get(r.id)!
      return [w.name, w.producer, w.region, w.appellation, w.grapes].some((t) => fold(t).includes(needle))
    })
    .sort(byName)
}
