/**
 * Import a cellar from a CSV file.
 *
 * The file is checked row by row first (a preview) and nothing is saved until the person confirms. Wines already in
 * the app are never deleted: a wine that is not there yet is added, and a wine that is there only gets its bottle
 * count increased by the number of bottles in the file (the file lists bottles to add, never the total).
 *
 * A port of app/importer.py of the original Lagar, checked against it on golden.json.
 */
import { newId } from '../ids'
import type { LagarStorage } from '../storage'
import type { OwnWindow, Wine, WineType } from '../types'
import { parseCsv } from './csv'
import { MESSAGES, type IssueKey } from './messages'
import { PROMPTS } from './prompts'

export type Lang = 'en' | 'es' | 'fr'

/** Something to tell the person about a row or the file. Shown in the interface language with message(). */
export interface Issue {
  key: IssueKey
  params?: Record<string, string | number>
}

export function message(issue: Issue, lang: Lang = 'en'): string {
  return MESSAGES[issue.key][lang].replace(/\{(\w+)\}/g, (_, name: string) => String(issue.params?.[name] ?? `{${name}}`))
}

export const MAX_BYTES = 2_000_000
export const MAX_ROWS = 5000

/** Columns of the template, in order. Only name, vintage and bottles are needed; the vintage is a year or NV, never empty. */
export const TEMPLATE_COLUMNS = ['name', 'vintage', 'bottles', 'type', 'producer', 'country', 'region', 'appellation', 'grapes', 'paid', 'purchase_date'] as const

type Column = (typeof TEMPLATE_COLUMNS)[number]

const ALIASES: Record<Column, string[]> = {
  name: ['name', 'wine', 'wine name', 'nombre', 'vino', 'nom', 'cuvee'],
  vintage: ['vintage', 'year', 'anada', 'ano', 'millesime', 'cosecha'],
  bottles: ['bottles', 'bottles now', 'bottles in cellar', 'qty', 'quantity', 'stock', 'botellas', 'bouteilles', 'cantidad'],
  type: ['type', 'colour', 'color', 'style', 'tipo', 'couleur'],
  producer: ['producer', 'winery', 'estate', 'bodega', 'productor', 'producteur', 'domaine'],
  country: ['country', 'pais', 'pays'],
  region: ['region', 'zona', 'region '],
  appellation: ['appellation', 'denominacion', 'denominacion de origen', 'do', 'doca', 'aoc', 'ap'],
  grapes: ['grapes', 'grape', 'varieties', 'variety', 'uvas', 'uva', 'variedades', 'cepages'],
  paid: ['paid', 'price', 'paid per bottle', 'price per bottle', 'precio', 'prix'],
  purchase_date: ['purchase_date', 'purchase date', 'date', 'bought', 'fecha', 'fecha de compra', 'date d achat'],
}
/** Optional columns, not part of the template: the person's own drinking window. Both must be valid years, or the window is ignored. */
const WINDOW_ALIASES = {
  from: ['drink_from', 'drink from', 'window from', 'from year', 'drink_from_year', 'beber desde', 'boire a partir de'],
  to: ['drink_to', 'drink to', 'window to', 'to year', 'drink_to_year', 'beber hasta', 'boire jusqu a'],
}

/** Read a window from two cells: whole years 1800-2100 with from <= to; anything else gives null. */
export function readWindow(from: string, to: string): OwnWindow | null {
  const year = (t: string) => (/^\d{4}$/.test(t.trim()) ? Number(t.trim()) : NaN)
  const a = year(from)
  const b = year(to)
  if (Number.isNaN(a) || Number.isNaN(b) || a < 1800 || b > 2100 || a > b) return null
  return { fromYear: a, toYear: b }
}

/** Optional column, not part of the template: the best critic score in points. */
const POINTS_ALIASES = ['points', 'critic points', 'critic score', 'score', 'puntos', 'puntos de critica', 'note critique', 'points critique']

/** Read points from a cell: a number from 50 to 100 (a score on another scale, or anything else, gives null). */
export function readPoints(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d{2,3}(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return n >= 50 && n <= 100 ? n : null
}

/** Optional columns, not part of the template: the details that the wine page shows under "More detail", plus alcohol
 *  and bottle size. They only fill a NEW wine; a wine already in the cellar keeps what it has. */
export interface Details {
  abv: number | null
  formatCl: number | null
  servingTemperature: string | null
  foodPairing: string | null
  tastingAppearance: string | null
  tastingNose: string | null
  tastingPalate: string | null
  link: string | null
  criticName: string | null
}
const DETAIL_ALIASES: Record<keyof Details, string[]> = {
  abv: ['abv', 'alcohol', 'alcohol %', 'abv %', 'graduacion', 'degre', 'degre d alcool'],
  formatCl: ['format_cl', 'format cl', 'format', 'size cl', 'bottle size', 'formato', 'volume cl'],
  servingTemperature: ['serving_temperature', 'serving temperature', 'serving', 'temperature', 'servicio', 'temperatura de servicio', 'temperature de service'],
  foodPairing: ['food_pairing', 'food pairing', 'pairing', 'maridaje', 'accords mets et vins', 'accord mets vins'],
  tastingAppearance: ['appearance', 'tasting_appearance', 'tasting appearance', 'vista', 'aspect', 'robe'],
  tastingNose: ['nose', 'tasting_nose', 'tasting nose', 'nariz', 'nez'],
  criticName: ['critic', 'critic_name', 'critic name', 'evaluator', 'points_by', 'points by', 'critico', 'critique'],
  link: ['link', 'url', 'shop_link', 'shop link', 'store_link', 'store link', 'enlace', 'lien'],
  tastingPalate: ['palate', 'tasting_palate', 'tasting palate', 'boca', 'palais', 'bouche'],
}
const DETAIL_KEYS = Object.keys(DETAIL_ALIASES) as (keyof Details)[]
const MAX_TEXT = 600

/** A number between lo and hi from a cell like "13,5%" or "75 cl"; anything else gives null. */
export function readAmount(text: string, lo: number, hi: number): number | null {
  const t = text.trim().toLowerCase().replace(/(%|cl|ml|vol\.?)$/, '').trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return n >= lo && n <= hi ? n : null
}

/** Read the optional detail cells of one row. Empty or unreadable cells give null. */
export function readDetails(cell: (k: keyof Details) => string): Details {
  const text = (k: keyof Details) => { const v = cell(k).trim().replace(/\s+/g, ' ').slice(0, MAX_TEXT); return v || null }
  return {
    abv: readAmount(cell('abv'), 0.5, 99),
    formatCl: readAmount(cell('formatCl'), 1, 1000),
    servingTemperature: text('servingTemperature'),
    foodPairing: text('foodPairing'),
    tastingAppearance: text('tastingAppearance'),
    tastingNose: text('tastingNose'),
    tastingPalate: text('tastingPalate'),
    criticName: text('criticName'),
    link: /^https?:\/\/\S+$/i.test(cell('link').trim()) ? cell('link').trim() : null,
  }
}

const HEADER = new Map<string, Column>()
for (const [key, aliases] of Object.entries(ALIASES) as [Column, string[]][]) for (const a of aliases) HEADER.set(a, key)

const COLOURS: Record<string, WineType> = {
  red: 'red', rouge: 'red', tinto: 'red', black: 'red',
  white: 'white', blanc: 'white', blanco: 'white',
  rose: 'rosé', rosado: 'rosé', pink: 'rosé',
  sparkling: 'sparkling', espumoso: 'sparkling', mousseux: 'sparkling', cava: 'sparkling', champagne: 'sparkling',
  fortified: 'fortified', generoso: 'fortified', fortifie: 'fortified', sherry: 'fortified', port: 'fortified',
  sweet: 'sweet', dulce: 'sweet', doux: 'sweet', dessert: 'sweet', liquoreux: 'sweet',
  cider: 'cider', sidra: 'cider', cidre: 'cider',
}

/** Lower case, no accents, only letters and digits: 'Viña Tondonia, Reserva' -> 'vina tondonia reserva'. */
export function plain(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Identity of a wine: its name without a trailing vintage, plus the vintage. */
export function wineKey(name: string, vintage: number | null): string {
  let n = plain(name)
  if (vintage && n.endsWith(' ' + vintage)) n = n.slice(0, -String(vintage).length - 1)
  return `${n}|${vintage ?? 'NV'}`
}

export function templateCsv(): string {
  return TEMPLATE_COLUMNS.join(',') + '\n'
}

/** The text to paste into an AI assistant. The column names and type words stay in English. */
export function prompt(lang: Lang): string {
  return PROMPTS[lang]
}

// ---------------------------------------------------------------- reading the file

export interface Form {
  name: string; vintage: string; bottles: string; colour: string; producer: string; country: string
  region: string; appellation: string; grapes: string; paid: string
}

/** The values of a row once cleaned and checked. */
export interface Parsed {
  name: string
  type: WineType | null
  producer: string | null
  country: string | null
  region: string | null
  appellation: string | null
  grapes: string | null
  /** null for non-vintage wines. */
  vintage: number | null
  bottles: number | null
  paid: number | null
}

export type Action = 'new' | 'update' | 'same' | 'error'

export interface ImportRow {
  /** The record number in the file (the header is 1). */
  line: number
  form: Form
  /** The purchase date as yyyy-mm-dd, or null. */
  added: string | null
  warnings: Issue[]
  error: Issue | null
  parsed: Parsed | null
  /** The drinking window from the optional drink_from / drink_to columns, if valid. */
  window?: OwnWindow | null
  /** Critic points from the optional points column, if valid. */
  points?: number | null
  /** The optional detail columns (alcohol, size, serving, pairing, tasting). */
  details?: Details
  // set by checkRows
  action?: Action
  label?: string
  vintage?: number | null
  bottles?: number | null
  wineId?: string
  was?: number
  now?: number
}

function decode(raw: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(raw) // a leading BOM is dropped
  } catch {
    return new TextDecoder('windows-1252').decode(raw)
  }
}

const isRealDate = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d))
  return y >= 1 && t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

function readDate(text: string): { date: string | null; warning: Issue | null } {
  text = text.trim()
  if (!text) return { date: null, warning: null }
  const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (m && isRealDate(+m[1], +m[2], +m[3])) return { date: iso(+m[1], +m[2], +m[3]), warning: null }
  for (const re of [/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, /^(\d{1,2})-(\d{1,2})-(\d{4})$/, /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/]) {
    m = re.exec(text)
    if (m && isRealDate(+m[3], +m[2], +m[1])) return { date: iso(+m[3], +m[2], +m[1]), warning: null }
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(text)
  if (m) {
    const yy = +m[3]
    const year = yy >= 69 ? 1900 + yy : 2000 + yy // as Python reads two-digit years
    if (isRealDate(year, +m[2], +m[1])) return { date: iso(year, +m[2], +m[1]), warning: null }
  }
  return { date: null, warning: { key: "Date '{x}' not understood (use YYYY-MM-DD); left empty.", params: { x: text } } }
}

const NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/

/** A number with a dot or a comma for decimals. Null when empty, NaN when it is not a number. */
function readNumber(text: string, whole: boolean): number | null {
  const t = text.trim().replace(/,/g, '.')
  if (!t) return null
  if (!NUMBER.test(t)) return NaN
  const n = Number(t)
  if (!Number.isFinite(n)) return NaN
  return whole ? Math.trunc(n) : n
}

const orNull = (s: string) => (s.trim() ? s.trim() : null)

/** Clean and check the values of a row. */
export function parseForm(f: Form): { parsed: Parsed; error: Issue | null } {
  const parsed: Parsed = {
    name: f.name.trim(), type: (f.colour as WineType) || null, producer: orNull(f.producer), country: orNull(f.country),
    region: orNull(f.region), appellation: orNull(f.appellation), grapes: orNull(f.grapes), vintage: null, bottles: null, paid: null,
  }
  if (!parsed.name) return { parsed, error: { key: 'The wine needs a name.' } }
  const year = f.vintage.trim()
  if (year !== '' && year.toLowerCase() !== 'nv') {
    const y = /^[+-]?\d+$/.test(year) ? parseInt(year, 10) : NaN
    if (Number.isNaN(y) || y < 1800 || y > 2100) return { parsed, error: { key: 'The vintage must be a year, or empty / NV.' } }
    parsed.vintage = y
  }
  const bottles = readNumber(f.bottles, true)
  const paid = readNumber(f.paid, false)
  if (Number.isNaN(bottles) || Number.isNaN(paid)) return { parsed, error: { key: 'Bottles, price paid, format and alcohol must be numbers.' } }
  parsed.bottles = bottles
  parsed.paid = paid
  if ((bottles !== null && bottles < 0) || (paid !== null && paid < 0)) return { parsed, error: { key: 'Bottles and price paid cannot be negative.' } }
  return { parsed, error: null }
}

/** Read the CSV bytes into rows. A file that cannot be read at all gives a fatal issue and no rows. */
export function readImport(raw: Uint8Array): { rows: ImportRow[]; fatal: Issue | null } {
  if (raw.length > MAX_BYTES) return { rows: [], fatal: { key: 'The file is too large (2 MB at most).' } }
  const text = decode(raw)
  const first = text.split('\n', 1)[0]
  const count = (ch: string) => first.split(ch).length - 1
  let delimiter = ','
  for (const d of [';', '\t']) if (count(d) > count(delimiter)) delimiter = d // on a tie the first of , ; tab wins
  const records = parseCsv(text, delimiter)
  if (records.length === 0) return { rows: [], fatal: { key: 'The file is empty.' } }
  const header = records[0]
  const cols = new Map<Column, number>()
  header.forEach((h, i) => {
    const p = plain(h)
    const k = HEADER.get(p) ?? HEADER.get(p.replaceAll(' ', '_'))
    if (k && !cols.has(k)) cols.set(k, i)
  })
  const detailAt = new Map<keyof Details, number>()
  let pointsAt = -1
  let windowFrom = -1
  let windowTo = -1
  header.forEach((h, i) => {
    const p = plain(h)
    for (const k of DETAIL_KEYS) if (!detailAt.has(k) && (DETAIL_ALIASES[k].includes(p) || DETAIL_ALIASES[k].includes(p.replaceAll(' ', '_')))) detailAt.set(k, i)
    if (pointsAt < 0 && POINTS_ALIASES.includes(p)) pointsAt = i
    if (windowFrom < 0 && WINDOW_ALIASES.from.includes(p)) windowFrom = i
    if (windowTo < 0 && WINDOW_ALIASES.to.includes(p)) windowTo = i
  })
  const missing = (['name', 'vintage', 'bottles'] as const).filter((k) => !cols.has(k))
  if (missing.length) {
    return { rows: [], fatal: { key: 'The first row must be the column names. I could not find: {missing}. Download the template and use its columns.', params: { missing: missing.join(', ') } } }
  }
  const rows: ImportRow[] = []
  records.slice(1).forEach((rec, idx) => {
    if (!rec.some((c) => c.trim())) return
    if (rows.length >= MAX_ROWS) return
    const line = idx + 2
    const get = (k: Column) => { const i = cols.get(k); return i !== undefined && i < rec.length ? rec[i].trim() : '' }
    const warnings: Issue[] = []
    let colour = get('type')
    if (colour) {
      const p = plain(colour)
      const mapped = Object.hasOwn(COLOURS, p) ? COLOURS[p] : undefined
      if (mapped === undefined) warnings.push({ key: "Type '{x}' not recognised; left empty.", params: { x: colour } })
      colour = mapped ?? ''
    }
    const { date, warning } = readDate(get('purchase_date'))
    if (warning) warnings.push(warning)
    const form: Form = {
      name: get('name'), vintage: get('vintage'), bottles: get('bottles'), colour, producer: get('producer'), country: get('country'),
      region: get('region'), appellation: get('appellation'), grapes: get('grapes'), paid: get('paid'),
    }
    const { parsed, error } = parseForm(form)
    let issue = error
    if (!issue && form.vintage === '') issue = { key: 'The vintage is required: write a year, or NV for a non-vintage wine.' }
    if (!issue && parsed.bottles === null) issue = { key: 'Bottles is empty.' }
    const window = windowFrom >= 0 && windowTo >= 0 ? readWindow(rec[windowFrom] ?? '', rec[windowTo] ?? '') : null
    const points = pointsAt >= 0 ? readPoints(rec[pointsAt] ?? '') : null
    const details = detailAt.size ? readDetails((k) => { const i = detailAt.get(k); return i !== undefined ? rec[i] ?? '' : '' }) : undefined
    rows.push({ line, form, added: date, warnings, error: issue, parsed, window, points, details })
  })
  if (records.slice(1).filter((rec) => rec.some((c) => c.trim())).length > MAX_ROWS) return { rows: [], fatal: { key: 'Too many rows (at most {n}).', params: { n: MAX_ROWS } } }
  if (rows.length === 0) return { rows: [], fatal: { key: 'The file has column names but no wines.' } }
  return { rows, fatal: null }
}

// ---------------------------------------------------------------- checking against the cellar, then saving

/** Label each valid row: new (will be added), update (same wine: the file's bottles are added to its stock),
 *  same (nothing to add) or error. */
export function checkRows(rows: ImportRow[], existing: Wine[]): ImportRow[] {
  const known = new Map<string, Wine>()
  for (const w of existing) {
    const key = wineKey(w.name, w.vintage === 'NV' ? null : w.vintage)
    if (!known.has(key)) known.set(key, w)
  }
  const seen = new Map<string, number>()
  for (const row of rows) {
    if (row.error || !row.parsed) { row.action = 'error'; continue }
    const v = row.parsed
    const key = wineKey(v.name, v.vintage)
    row.label = v.name
    row.vintage = v.vintage
    row.bottles = v.bottles
    if (seen.has(key)) {
      row.error = { key: 'Same wine and vintage as line {n}; this line is skipped.', params: { n: seen.get(key)! } }
      row.action = 'error'
      continue
    }
    seen.set(key, row.line)
    const hit = known.get(key)
    if (!hit) row.action = 'new'
    else if (v.bottles! > 0) {
      row.action = 'update'
      row.wineId = hit.id
      row.was = hit.bottles
      row.now = hit.bottles + v.bottles!
    } else {
      row.action = 'same'
      row.wineId = hit.id
    }
  }
  return rows
}

/** Save what the preview showed. Returns how many wines were added and how many got more bottles. */
export async function applyRows(storage: LagarStorage, rows: ImportRow[], now = new Date()): Promise<{ added: number; updated: number }> {
  const toSave: Wine[] = []
  let added = 0
  let updated = 0
  for (const row of rows) {
    const v = row.parsed
    if (!v || v.bottles === null) continue
    if (row.action === 'new') {
      toSave.push({
        id: newId(), name: v.name, vintage: v.vintage ?? 'NV', bottles: v.bottles, type: v.type, producer: v.producer,
        country: v.country, region: v.region, appellation: v.appellation, grapes: v.grapes, abv: row.details?.abv ?? null, formatCl: row.details?.formatCl ?? 75,
        paid: v.paid, criticPoints: row.points ?? null, criticName: row.points != null ? row.details?.criticName ?? null : null, purchaseDate: row.added, addedAt: now.toISOString(), ownWindow: row.window ?? null,
        servingTemperature: row.details?.servingTemperature ?? null, foodPairing: row.details?.foodPairing ?? null,
        tastingAppearance: row.details?.tastingAppearance ?? null, tastingNose: row.details?.tastingNose ?? null,
        tastingPalate: row.details?.tastingPalate ?? null, criticsOpinion: null, link: row.details?.link ?? null,
      })
      added++
    } else if (row.action === 'update' && row.wineId) {
      const wine = await storage.getWine(row.wineId)
      if (!wine) continue
      toSave.push({ ...wine, bottles: wine.bottles + v.bottles })
      updated++
    }
  }
  await storage.putWines(toSave)
  return { added, updated }
}

/** Read, check and return the rows for a preview. */
export async function previewImport(storage: LagarStorage, raw: Uint8Array): Promise<{ rows: ImportRow[]; fatal: Issue | null }> {
  const { rows, fatal } = readImport(raw)
  if (fatal) return { rows, fatal }
  return { rows: checkRows(rows, await storage.listWines()), fatal: null }
}
