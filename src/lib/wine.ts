/**
 * The wine page: the name band, the drink block, the form to add or edit a wine, and opening a bottle.
 * Pure functions; the screens only show what these return. Ported from the original Lagar (main.py, db.py).
 */
import type { Advice, Status } from './advice/engine'
import { translate } from './i18n'
import { newId } from './ids'
import { message, parseForm, type Issue, type Lang } from './import/importer'
import type { OpenedBottle, OwnWindow, Wine, WineType } from './types'
import { WINE_TYPES } from './types'

// ---------------------------------------------------------------- the name band

const NOT_THE_NAME = new Set([
  'reserva', 'gran', 'crianza', 'brut', 'blanco', 'tinto', 'rosado', 'selection', 'selección', 'grand', 'cru', 'premier', '1er',
  'vieilles', 'vieille', 'vinas', 'viñas', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'et', 'the', 'of',
])

export interface NamePart { text: string; size: number; tracking: string }
export interface NameParts { pre: NamePart | null; main: { text: string; size: number }; post: NamePart | null }

/** Splits a wine name into the three lines of the name band: prefix, the main word and suffix.
 *  'Viña Tondonia Reserva 2004' -> ('Viña', 'Tondonia', 'Reserva'). The vintage is shown apart. */
export function nameParts(name: string): NameParts {
  const n = (name ?? '').replace(/\s+(?:19|20)\d{2}\s*$/, '').trim()
  const words = n.split(/\s+/).filter(Boolean)
  let pre = ''
  let main = n
  let post = ''
  if (words.length > 1) {
    let best = 0
    let bestLen = -1
    words.forEach((w, i) => {
      const len = NOT_THE_NAME.has(w.toLowerCase()) ? 0 : w.length
      if (len > bestLen) { best = i; bestLen = len } // on a tie the first word wins
    })
    pre = words.slice(0, best).join(' ')
    main = words[best]
    post = words.slice(best + 1).join(' ')
  }
  const small = (text: string): NamePart => ({
    text, size: text.length <= 12 ? 22 : text.length <= 22 ? 17 : 14, tracking: text.length <= 12 ? '0.34em' : '0.2em',
  })
  const size = Math.max(26, Math.min(57, Math.floor(340 / (Math.max(main.length, 1) * 0.72))))
  return { pre: pre ? small(pre) : null, main: { text: main, size }, post: post ? small(post) : null }
}

// ---------------------------------------------------------------- the drink block

type Key = string
export interface DrinkView {
  /** Text key for the big word: Now, Soon, Can wait, Keep, Evolves. */
  word: Key
  /** 'until 2031' / 'from 2030', as a key and a year. */
  until: { key: 'from {year}' | 'until {year}'; year: number } | null
  /** The sentence that says what the status means. */
  help: Key
  /** The long note, shown only when there is no window to read. */
  note: string | null
  source: Key
}

const WORD: Record<Status, Key> = { drink_now: 'Now', drink_soon: 'Soon', can_wait: 'Can wait', keep: 'Keep', evolves: 'Evolves' }
const HELP: Record<Status, Key> = {
  drink_now: 'At or past its best, or a style meant to be drunk young.',
  drink_soon: "The window ends within the next two years. Wines of the last 4 vintages that would be 'drink now' are shown here instead.",
  can_wait: 'Within its window, no rush.',
  keep: 'Not ready yet: better from a later year.',
  evolves: 'Drinkable now, but ageing changes it rather than improving or ruining it (e.g. sherry).',
}

export function drinkView(a: Advice): DrinkView {
  const hasWindow = a.fromYear !== null || a.toYear !== null
  const until =
    a.status === 'keep' && a.fromYear !== null ? { key: 'from {year}' as const, year: a.fromYear }
    : a.toYear !== null ? { key: 'until {year}' as const, year: a.toYear }
    : a.fromYear !== null ? { key: 'from {year}' as const, year: a.fromYear }
    : null
  const regulator = a.source === 'rule' && a.note.includes('Consejo Regulador')
  return {
    word: WORD[a.status],
    until,
    help: a.status === 'can_wait' && !hasWindow ? 'No window known, so no rush.' : HELP[a.status],
    // A window from your own decision or from a style rule is read from the years; only a wine with no window keeps the note.
    note: a.source === 'rule' && !hasWindow ? a.note : null,
    source: a.source === 'own' ? 'your own decision' : regulator ? 'the Consejo Regulador' : 'general style rules',
  }
}

// ---------------------------------------------------------------- the form

export interface WineForm {
  name: string; type: string; vintage: string; bottles: string; paid: string
  producer: string; country: string; region: string; appellation: string; grapes: string
  formatCl: string; abv: string; criticPoints: string; purchaseDate: string
  windowFrom: string; windowTo: string
  servingTemperature: string; foodPairing: string; tastingAppearance: string; tastingNose: string; tastingPalate: string
}

const num = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))

export function formFrom(w: Wine | null): WineForm {
  return {
    name: w?.name ?? '', type: w?.type ?? '', vintage: w ? String(w.vintage) : '', bottles: w ? String(w.bottles) : '', paid: num(w?.paid ?? null),
    producer: w?.producer ?? '', country: w?.country ?? '', region: w?.region ?? '', appellation: w?.appellation ?? '', grapes: w?.grapes ?? '',
    formatCl: w ? num(w.formatCl) : '75', abv: num(w?.abv ?? null), criticPoints: num(w?.criticPoints ?? null), purchaseDate: w?.purchaseDate ?? '',
    windowFrom: w?.ownWindow?.fromYear ? String(w.ownWindow.fromYear) : '', windowTo: w?.ownWindow?.toYear ? String(w.ownWindow.toYear) : '',
    servingTemperature: w?.servingTemperature ?? '', foodPairing: w?.foodPairing ?? '', tastingAppearance: w?.tastingAppearance ?? '',
    tastingNose: w?.tastingNose ?? '', tastingPalate: w?.tastingPalate ?? '',
  }
}

const orNull = (s: string) => (s.trim() ? s.trim() : null)
const asNumber = (s: string) => Number(s.trim().replace(',', '.'))

export type FormResult = { wine: Wine; error?: undefined } | { wine?: undefined; error: string }

const isIsoDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}

/** Check the form and build the wine. `base` is the wine being edited (its id and date added are kept), or null for a new one.
 *  The error is already in the language of the interface. */
export function wineFromForm(input: WineForm, base: Wine | null, lang: Lang, now = new Date()): FormResult {
  // A number box hands over a number (or nothing) instead of text; read every field as text.
  const f = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])) as unknown as WineForm
  const tr = (key: string) => translate(lang, key)
  const fail = (issue: Issue): FormResult => ({ error: message(issue, lang) })
  const year = f.vintage.trim()
  // The same checks as the import: name, vintage (a year or NV, never empty), numbers.
  const { parsed, error } = parseForm({
    name: f.name, vintage: year, bottles: f.bottles, colour: f.type, producer: f.producer, country: f.country,
    region: f.region, appellation: f.appellation, grapes: f.grapes, paid: f.paid,
  })
  if (error) return fail(error)
  if (year === '') return fail({ key: 'The vintage is required: write a year, or NV for a non-vintage wine.' })
  const bottles = f.bottles.trim() === '' ? 0 : parsed.bottles!
  const format = f.formatCl.trim() === '' ? null : asNumber(f.formatCl)
  const abv = f.abv.trim() === '' ? null : asNumber(f.abv)
  if ((format !== null && !(format > 0)) || (abv !== null && !(abv >= 0)))
    return fail({ key: 'Bottles, price paid, format and alcohol must be numbers.' })
  const points = f.criticPoints.trim() === '' ? null : asNumber(f.criticPoints)
  if (points !== null && !(points >= 50 && points <= 100)) return { error: tr('Critic points must be a number from 50 to 100.') }
  const date = f.purchaseDate.trim()
  if (date && !isIsoDate(date)) return { error: tr('That purchase date is not valid.') }
  let ownWindow: OwnWindow | null = null
  const from = f.windowFrom.trim()
  const to = f.windowTo.trim()
  if (from || to) {
    const y = (s: string) => (s === '' ? null : /^\d{4}$/.test(s) ? Number(s) : NaN)
    const a = y(from)
    const b = y(to)
    if ((a !== null && Number.isNaN(a)) || (b !== null && Number.isNaN(b)) || (a !== null && b !== null && a > b))
      return { error: tr('The window years must be four-digit years, and "from" cannot be after "to".') }
    ownWindow = { fromYear: a, toYear: b }
  }
  const type = (WINE_TYPES as readonly string[]).includes(f.type) ? (f.type as WineType) : null
  return {
    wine: {
      id: base?.id ?? newId(), name: parsed.name, vintage: parsed.vintage ?? 'NV', bottles, type,
      producer: parsed.producer, country: parsed.country, region: parsed.region, appellation: parsed.appellation, grapes: parsed.grapes,
      abv, formatCl: format, paid: parsed.paid, criticPoints: points, purchaseDate: date || null,
      addedAt: base?.addedAt ?? now.toISOString(), ownWindow,
      servingTemperature: orNull(f.servingTemperature), foodPairing: orNull(f.foodPairing), tastingAppearance: orNull(f.tastingAppearance),
      tastingNose: orNull(f.tastingNose), tastingPalate: orNull(f.tastingPalate), criticsOpinion: base?.criticsOpinion ?? null,
    },
  }
}

// ---------------------------------------------------------------- opening a bottle

export interface Say { key: string; params?: Record<string, string | number> }
export type OpenResult =
  | { ok: true; wine: Wine; record: OpenedBottle; say: Say }
  | { ok: false; say: Say }

/** Today as yyyy-mm-dd on the person's own clock (not UTC). */
export function todayIso(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** "I opened this": lowers the stock by the number opened and says how many are left. */
export function openBottle(wine: Wine, input: { date: string; qty: number; occasion: string; note: string }): OpenResult {
  const { qty } = input
  if (!isIsoDate(input.date)) return { ok: false, say: { key: 'That date is not valid.' } }
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, say: { key: 'Enter at least 1 bottle.' } }
  if (qty > wine.bottles) {
    return {
      ok: false,
      say: wine.bottles === 0 ? { key: 'No bottles of this wine left.' }
        : wine.bottles === 1 ? { key: 'Still one bottle. Look for a nice occasion!' }
        : { key: 'Only {n} bottles of this wine. Look for a nice occasion!', params: { n: wine.bottles } },
    }
  }
  const left = wine.bottles - qty
  const say: Say =
    qty === 1 && left === 0 ? { key: 'Enjoy! A pity this was your last bottle.' }
    : qty === 1 && left === 1 ? { key: 'Enjoy! One bottle left for a special occasion.' }
    : qty === 1 ? { key: 'Enjoy! Still {n} to share with friends!', params: { n: left } }
    : { key: 'Enjoy! Marked {n} bottles as opened.', params: { n: qty } }
  return {
    ok: true, say,
    wine: { ...wine, bottles: left },
    record: { id: newId(), wineId: wine.id, date: input.date, qty, occasion: orNull(input.occasion), note: orNull(input.note) },
  }
}

/** Undo: removing the record gives the bottles back to the stock. */
export function undoOpened(wine: Wine, record: OpenedBottle): Wine {
  return { ...wine, bottles: wine.bottles + record.qty }
}
