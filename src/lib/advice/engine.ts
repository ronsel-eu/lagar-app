/**
 * Drinking advice: a keep-or-drink status for every wine.
 *
 * A port of the style rules of the original Lagar (scripts/advice.py). It uses only what the person typed or
 * imported: the name, type, vintage, appellation, region, grapes and the last purchase. No critic or shop data.
 * The person's own window, if they set one, beats the rules.
 *
 * The year is a parameter (never "today" inside the rules), so results are repeatable.
 * Every rule is checked against the original on the wines in golden.json (see tools/make_golden.py).
 */
import type { Wine, WineType } from '../types'

export type Status = 'drink_now' | 'drink_soon' | 'can_wait' | 'keep' | 'evolves'
export type Keeps = 'holds' | 'declines' | 'evolves'

export interface Advice {
  status: Status
  fromYear: number | null
  toYear: number | null
  keeps: Keeps
  /** Where the advice comes from: the person's own window, or the style rules. */
  source: 'own' | 'rule'
  note: string
}

/** What the rules read from a wine. */
export interface AdviceInput {
  name: string
  type: WineType | null
  /** null for non-vintage wines. */
  vintage: number | null
  region: string | null
  appellation: string | null
  grapes: string | null
  producer: string | null
  /** yyyy-mm-dd */
  lastPurchase: string | null
}

export const YOUNG_YEARS = 4 // vintages of the last 4 years are never "drink now"
export const SOON_YEARS = 2 // "drink soon" = the window ends within the next 2 years

type Rule = Omit<Advice, 'source'>

// ---------------------------------------------------------------- helpers

/** Lower case, no accents, only a-z, 0-9 and spaces. */
export function norm(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFKD')
    .replace(/[^\x00-\x7f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
}

/** True if any of the words appears as a whole word (or phrase) in the text. */
function has(text: string, ...words: string[]): boolean {
  return words.some((w) => new RegExp('\\b' + w + '\\b').test(text))
}

export function statusFromWindow(from: number | null, to: number | null, year: number): Status {
  if (to !== null && to < year) return 'drink_now' // past the window: do not wait any longer
  if (to !== null && to - year <= SOON_YEARS) return 'drink_soon'
  if (from !== null && from > year) return 'keep'
  return 'can_wait'
}

/** A rule whose status follows from its window. */
function win(year: number, a: number, b: number, keeps: Keeps, note: string): Rule {
  return { status: statusFromWindow(a, b, year), fromYear: a, toYear: b, keeps, note }
}

function purchaseYear(w: AdviceInput): number | null {
  const y = w.lastPurchase ? parseInt(w.lastPurchase.slice(0, 4), 10) : NaN
  return Number.isNaN(y) ? null : y
}

const where = (w: AdviceInput) => norm((w.appellation ?? '') + ' ' + (w.region ?? ''))

// ---------------------------------------------------------------- sherry (Consejo Regulador table)

const MONTHS = new Map<string, number>([
  ['enero', 1], ['febrero', 2], ['marzo', 3], ['abril', 4], ['mayo', 5], ['junio', 6], ['julio', 7], ['agosto', 8],
  ['septiembre', 9], ['octubre', 10], ['noviembre', 11], ['diciembre', 12],
  ['invierno', 1], ['primavera', 4], ['verano', 7], ['otono', 10],
])

type SherryKind = 'manzanilla' | 'fino' | 'cream' | 'amontillado' | 'palo cortado' | 'oloroso' | 'pedro ximenez'

// kind -> months in closed bottle from filling (null = indefinite)
const SHERRY_MONTHS: Record<SherryKind, number | null> = {
  manzanilla: 18, fino: 18, cream: 36, amontillado: 60, 'palo cortado': null, oloroso: null, 'pedro ximenez': null,
}
const SHERRY_TABLE_TEXT: Record<SherryKind, string> = {
  manzanilla: '12 to 18 months', fino: '12 to 18 months', cream: 'up to 2-3 years',
  amontillado: 'up to 5 years (more if VOS/VORS)', 'palo cortado': 'indefinite', oloroso: 'indefinite',
  'pedro ximenez': 'indefinite',
}

function sherryKind(w: AdviceInput): { kind: SherryKind; veryOld: boolean; remark: string } | null {
  if (w.type !== 'fortified' && w.type !== 'sweet') return null
  const text = norm(w.name) + '  ' + norm(w.producer)
  if (has(text, 'vermut', 'vermouth', 'madeira', 'porto', 'oporto', 'lbv', 'late bottled')) return null
  const veryOld = has(text, 'vors', 'vos')
  const own = norm(w.name)
  if (own.includes('vendimia tardia')) return null // late-harvest table wine, not a sherry
  const k = (kind: SherryKind, remark = '') => ({ kind, veryOld, remark })
  if (has(own, 'pedro ximenez', 'px') || own.includes('ximenez spinola')) return k('pedro ximenez')
  if (has(text, 'pasada')) return k('amontillado', 'Manzanilla pasada is an aged manzanilla; treated like amontillado.')
  if (has(text, 'manzanilla', 'florpower')) return k('manzanilla')
  if (has(text, 'fino') || text.includes('tio pepe')) return k('fino')
  if (has(text, 'amontillado')) return k('amontillado')
  if (has(text, 'palo cortado')) return k('palo cortado')
  if (has(text, 'oloroso', 'sibarita')) return k('oloroso')
  if (has(text, 'pedro ximenez', 'px') || text.includes('ximenez spinola')) return k('pedro ximenez')
  if (has(text, 'moscatel')) return k('pedro ximenez', 'Moscatel is not in the Consejo table; treated like Pedro Ximénez (sweet, long-lived).')
  if (has(text, 'cream', 'medium')) return k('cream')
  return null
}

interface YMD { year: number; month: number; day: number }

function validIsoDate(s: string): YMD | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  return { year, month, day }
}

/** Filling date of a sherry: the "saca" in the name when there is one, otherwise the last purchase date
 *  (a bottle is always filled before it is bought, so this is the latest it can be). */
function bottlingDate(w: AdviceInput): { date: YMD; why: string } | null {
  const name = norm(w.name)
  let m = /\bsaca\b\s*(?:(\w+)\s+)?(?:de\s+)?(\d{4})/.exec(name)
  if (m) {
    const month = MONTHS.get(m[1] ?? '') ?? 7
    return { date: { year: Number(m[2]), month, day: 15 }, why: `the saca in the name (${m[2]})` }
  }
  m = /\bm{2}([xvi]+)\b/.exec(name) // Equipo Navazos writes the saca year in Roman numerals (MMXV)
  if (m) {
    const vals: Record<string, number> = { i: 1, v: 5, x: 10 }
    const r = [...m[1]].map((c) => vals[c])
    const sum = r.reduce((acc, x, i) => acc + (i + 1 < r.length && x < r[i + 1] ? -x : x), 0)
    const yr = 2000 + sum
    return { date: { year: yr, month: 7, day: 15 }, why: `the saca year in the name (${yr})` }
  }
  const lp = w.lastPurchase
  if (lp) {
    const d = validIsoDate(lp)
    if (d) return { date: d, why: `the last purchase date (${lp.slice(8, 10)}/${lp.slice(5, 7)}/${lp.slice(0, 4)}), because the filling date is unknown` }
  }
  return null
}

function addMonths(d: YMD, n: number): YMD {
  const total = d.month - 1 + n
  const y = Math.floor(total / 12)
  const m = total - y * 12
  return { year: d.year + y, month: m + 1, day: Math.min(d.day, 28) }
}

function sherryAdvice(w: AdviceInput, year: number): Rule | null {
  const k = sherryKind(w)
  if (!k) return null
  const { kind, veryOld, remark } = k
  let months = SHERRY_MONTHS[kind]
  if (veryOld && ['amontillado', 'manzanilla', 'fino', 'cream'].includes(kind)) months = null
  const label = veryOld ? 'VORS/VOS' : kind
  let table = months === null ? 'indefinite' : SHERRY_TABLE_TEXT[kind]
  if (veryOld && kind === 'amontillado') table = 'indefinite for VOS/VORS'
  const note = `Sherry (${label}): Consejo Regulador says ${table} in closed bottle from filling.`
  const tail = remark ? ' ' + remark : ''
  if (months === null) {
    return { status: 'evolves', fromYear: null, toYear: null, keeps: 'evolves', note: note + ' It keeps and changes slowly, so there is no deadline.' + tail }
  }
  const b = bottlingDate(w)
  if (!b) {
    return { status: 'can_wait', fromYear: null, toYear: null, keeps: 'declines', note: note + ' Filling date unknown, so no window can be given.' + tail }
  }
  const end = addMonths(b.date, months)
  const a = b.date.year
  const to = end.year
  return {
    status: statusFromWindow(a, to, year), fromYear: a, toYear: to, keeps: 'declines',
    note: note + ` Counted from ${b.why}: best until ${String(end.month).padStart(2, '0')}/${end.year}.` + tail,
  }
}

// ---------------------------------------------------------------- Bordeaux and Riesling

const BORDEAUX = /bordeaux|burdeos|medoc|margaux|pauillac|saint[- ]julien|saint[- ]estephe|graves|pessac|fronsac|pomerol|saint[- ]emilion|blaye|cadillac|entre[- ]deux[- ]mers|sauternes|barsac|castillon|francs|loupiac/
const BORDEAUX_GENERIC = /^(bordeaux|bordeaux superieur|cotes de bordeaux|blaye cotes de bordeaux|cadillac cotes de bordeaux|premieres cotes de bordeaux|entre[- ]deux[- ]mers|cotes de bordeaux saint[- ]macaire)$/

/** Bordeaux guide by type: generic AC 2-8 years, named-commune and Cru Bourgeois level 5-15, Sauternes 10-40,
 *  simple dry whites 1-2 years. Null outside Bordeaux. */
function bordeauxRule(w: AdviceInput, year: number): Rule | null {
  const wh = where(w)
  const app = norm(w.appellation)
  let v = w.vintage
  if (!v || !BORDEAUX.test(wh)) return null
  if (v > year) v = year
  if (w.type === 'sweet' || has(app, 'sauternes', 'barsac')) {
    if (has(app, 'sauternes', 'barsac')) return win(year, v + 10, v + 40, 'holds', 'Bordeaux guide: Sauternes 10 to 40+ years from the vintage.')
    return null
  }
  if (w.type === 'white') {
    if (BORDEAUX_GENERIC.test(app)) return win(year, v, v + 2, 'declines', 'Bordeaux guide: simple dry white, drink within 1-2 years.')
    return win(year, v + 5, v + 20, 'holds', 'Bordeaux guide: dry white 5 to 20 years from the vintage.')
  }
  if (w.type !== 'red') return null
  if (BORDEAUX_GENERIC.test(app)) return win(year, v + 2, v + 8, 'holds', 'Bordeaux guide: entry-level and generic appellations, 2 to 8 years from the vintage.')
  return win(year, v + 5, v + 15, 'holds', 'Bordeaux guide: named appellation (Cru Bourgeois level or second wine), 5 to 15 years from the vintage.')
}

const SINGLE_VINEYARD = ['grosses gewachs', ' gg ', 'grosse lage', 'grosser ', 'grosse ', 'pechstein', 'gerumpel', 'geierslay',
  'goldtropfchen', 'juffer', 'hengelberg', 'grand cru', 'frederic emile', 'clos ste hune', 'lage ']

/** Riesling by category, any region. Windows are counted from the vintage. Null for wines that are not Riesling. */
function rieslingRule(w: AdviceInput, year: number): Rule | null {
  const name = ' ' + norm(w.name) + ' '
  const grapes = norm(w.grapes)
  let v = w.vintage
  // Kept as in the original: norm() turns "%" into a space, so the grapes test below can never be true and only
  // the name decides whether a wine is read as Riesling. Fixing it would change the original's results.
  if (!v || !(name.includes('riesling') || grapes === '100% riesling')) return null
  if ((w.type !== 'white' && w.type !== 'sweet') || has(name, 'sparkling', 'sekt', 'brut nature')) return null
  if (v > year) v = year
  let a: number, b: number, note: string
  if (has(name, 'trockenbeerenauslese', 'beerenauslese', ' tba ', ' ba ', 'eiswein', 'icewine')) {
    ;[a, b, note] = [v + 20, v + 50, 'Noble sweet Riesling (BA, TBA, Eiswein): 20 to 50+ years from the vintage.']
  } else if (has(name, 'auslese') && !has(name, 'spatlese')) {
    ;[a, b, note] = [v + 10, v + 25, 'Riesling Auslese: 10 to 25+ years from the vintage.']
  } else if (has(name, 'spatlese')) {
    ;[a, b, note] = [v + 5, v + 15, 'Riesling Spätlese: 5 to 15 years from the vintage.']
  } else if (has(name, 'kabinett')) {
    ;[a, b, note] = [v + 2, v + 8, 'Riesling Kabinett: 2 to 8 years from the vintage.']
  } else if (SINGLE_VINEYARD.some((k) => name.includes(k))) {
    ;[a, b, note] = [v + 5, v + 15, 'Dry single-vineyard Riesling (GG and similar): 5 to 15+ years from the vintage.']
  } else {
    ;[a, b, note] = [v + 1, v + 3, 'Everyday Riesling: 1 to 3 years from the vintage.']
  }
  return win(year, a, b, 'holds', note + ' Category read from the name.')
}

// ---------------------------------------------------------------- general style rules

function rules(w: AdviceInput, year: number): Rule {
  const sh = sherryAdvice(w, year)
  if (sh) return sh
  const rr = rieslingRule(w, year)
  if (rr) return rr
  const name = norm(w.name)
  const colour = w.type
  let v = w.vintage
  const text = name + ' '
  const wh = where(w)
  const done = (a: number, b: number, keeps: Keeps, note: string) => win(year, a, b, keeps, note)

  // port
  if (colour === 'fortified' && (has(text, 'porto', 'oporto', 'lbv', 'late bottled', 'tawny', 'colheita', 'ruby', 'vintage port') || text.split(/\s+/).filter(Boolean).includes('port'))) {
    const base = purchaseYear(w) ?? year
    if (has(text, 'lbv', 'late bottled')) {
      const start = v ? v + 4 : base
      return done(start, start + 5, 'declines', 'Late Bottled Vintage port: 0 to 5 years from release. Release estimated 4 years after the harvest.')
    }
    if (has(text, 'colheita')) return done(base, base + 3, 'declines', 'Colheita port: 0 to 3 years from release. Release date not known: last purchase year used.')
    if (has(text, 'tawny')) return done(base, base + 2, 'declines', 'Tawny port: 0 to 2 years from release. Release date not known: last purchase year used.')
    if (has(text, 'ruby', 'reserva', 'reserve')) return done(base, base + 3, 'declines', 'Ruby port: 0 to 3 years from release. Release date not known: last purchase year used.')
    if (v) return done(v + 15, v + 40, 'holds', 'Vintage port: 15 to 40 years from the harvest.')
    return done(base, base + 3, 'declines', 'Port without a recognised style (ruby band used): 0 to 3 years from release.')
  }
  if (colour === 'fortified' || has(text.replaceAll('vintage to check', ''), 'madeira', 'porto', 'oporto', 'vermut', 'late bottled', 'lbv', 'vintage')) {
    if (has(text, 'vermut')) return { status: 'drink_now', fromYear: null, toYear: null, keeps: 'declines', note: 'Vermouth: best within a couple of years of bottling, then in the fridge once opened.' }
    return { status: 'evolves', fromYear: null, toYear: null, keeps: 'evolves', note: 'Fortified wine: it keeps for a long time.' }
  }
  if (colour === 'cider') return { status: 'drink_now', fromYear: null, toYear: null, keeps: 'declines', note: 'Cider and perry: drink within a year or two.' }
  if (colour === 'sweet' && has(name, 'fondillon') && v) { // (a fortified Fondillón was already answered above)
    return done(v + 20, v + 50, 'evolves', 'Fondillón: 20 to 50+ years from the vintage.')
  }
  if (colour === 'sweet' && has(name, 'tostado') && norm((w.appellation ?? '') + ' ' + (w.region ?? '')).includes('ribeiro') && v) {
    return done(v + 10, v + 30, 'holds', 'Tostado do Ribeiro: 10 to 30+ years from the vintage.')
  }
  if (colour === 'sweet' && has(norm(w.appellation), 'sauternes', 'barsac') && v) {
    const bx = bordeauxRule(w, year)
    if (bx) return bx
  }
  if (colour === 'sweet' || has(text, 'sauternes', 'barsac', 'late harvest', 'vendimia tardia', 'dulce', 'icewine', 'tokaj')) {
    const base = v || year
    return done(base + 3, base + 25, 'holds', 'Sweet wine: high sugar and acidity let it hold for decades.')
  }

  // sparkling
  if (colour === 'sparkling' && (norm(w.appellation) === 'champagne' || has(text, 'champagne'))) {
    const prestige = has(text, 'dom perignon', 'cristal', 'krug', 'salon', 'enchanteleurs', 'grande dame', 'comtes de champagne', 'belle epoque', 'clos du mesnil', 'winston churchill', 'cuvee prestige', 'cuvee de prestige')
    if (prestige && v) return done(v + 12, v + 30, 'holds', 'Prestige cuvée Champagne: 12 to 30+ years from the vintage.')
    if (v) return done(v + 8, v + 20, 'holds', 'Vintage Champagne: 8 to 20+ years from the vintage.')
    const base = purchaseYear(w) ?? year
    return done(base, base + 3, 'declines', 'Non-vintage Champagne: 1 to 3 years, up to 5, after release. The release date is not known, so the last purchase year is used as the start.')
  }
  if (colour === 'sparkling' && (norm(w.appellation) === 'cava' || has(text, 'cava')) && !has(text, 'champagne', 'frizzante')) {
    let gap: number, span: number, note: string
    if (has(text, 'paraje')) [gap, span, note] = [4, 10, 'Cava de Paraje Calificado: 3 to 10+ years after disgorgement.']
    else if (has(text, 'gran reserva')) [gap, span, note] = [3, 3, 'Cava Guarda Superior Gran Reserva: 2 to 3 years after disgorgement.']
    else if (has(text, 'reserva')) [gap, span, note] = [2, 2, 'Cava Guarda Superior Reserva: 1 to 2 years after disgorgement.']
    else [gap, span, note] = [1, 2, 'Cava de Guarda: 1 to 1.5 years after disgorgement, drink for freshness.']
    let a: number
    if (v) {
      a = v + gap
      note += ` Disgorgement date not known: estimated ${gap} year(s) after the vintage, from the minimum ageing.`
    } else {
      a = purchaseYear(w) ?? year
      note += ' No vintage and no disgorgement date: the last purchase year is used.'
    }
    return done(a, a + span, 'declines', note)
  }
  const utiel = wh.includes('utiel')
  if (colour === 'sparkling' && !utiel && wh.includes('valencia') && has(text, 'cava') && !has(text, 'reserva') && v) {
    return done(v, v + 3, 'declines', 'Valencia cava: 1 to 3 years from disgorgement. The disgorgement date is not known, so the vintage is used.')
  }
  if (colour === 'sparkling' && utiel && v) {
    return done(v, v + 4, 'declines', 'Utiel-Requena cava: 1 to 4 years from disgorgement. The disgorgement date is not known, so the vintage is used.')
  }
  if (colour === 'sparkling') {
    if (has(text, 'frizzante')) return { status: 'drink_now', fromYear: null, toYear: null, keeps: 'declines', note: 'Light frizzante: drink young and fresh.' }
    if (has(text, 'champagne')) {
      if (v) return done(v + 3, v + 15, 'holds', 'Vintage Champagne: ages well for 10+ years.')
      return { status: 'can_wait', fromYear: null, toYear: null, keeps: 'holds', note: 'Non-vintage Champagne: good now, and gains a little with 2-3 years.' }
    }
    if (has(text, 'gran reserva', 'reserva')) {
      const b = v || year - 3
      return done(b + 3, b + 8, 'holds', 'Cava with long lees ageing: ready now and holds some years.')
    }
    const b = v || year - 1
    return done(b, b + 3, 'declines', 'Young sparkling: drink within 2-3 years of the vintage.')
  }

  if (!v) return { status: 'can_wait', fromYear: null, toYear: null, keeps: 'holds', note: 'No vintage known: set a window by hand if you want a precise status.' }
  if (v >= year + 1) v = year

  const bx = bordeauxRule(w, year)
  if (bx) return bx

  if (colour === 'rosé') {
    if (has(text, 'tondonia', 'gran reserva', 'reserva')) return done(v + 6, v + 30, 'holds', 'Aged rosé (e.g. López de Heredia): a rare long-lived style, from about 6 years.')
    return done(v, v + 2, 'declines', 'Rosé: drink within two years of the vintage.')
  }

  // (rosé wines were already answered above, so the rosé cases of the next regions are not needed)
  if (wh.includes('bierzo') && (colour === 'red' || colour === 'white')) {
    if (has(text, 'clarete')) return done(v + 1, v + 2, 'declines', 'Bierzo rosé or clarete: 1 to 2 years from the vintage.')
    if (colour === 'white') return done(v + 2, v + 5, 'holds', 'Bierzo still white, Godello: 2 to 5 years from the vintage.')
    if (has(text, 'paraje', 'villa', 'valtuille', 'cepas centenarias', 'vinas viejas', 'viejas', 'centenari')) {
      return done(v + 5, v + 15, 'holds', 'Bierzo paraje, village or old-vine cru: 5 to 15+ years from the vintage. Category read from the name.')
    }
    if (has(text, 'joven')) return done(v + 1, v + 3, 'declines', 'Bierzo joven, no oak: 1 to 3 years from the vintage.')
    return done(v + 3, v + 7, 'holds', 'Bierzo standard Mencía or crianza: 3 to 7 years from the vintage.')
  }
  if (utiel && colour === 'red') {
    if (has(text, 'gran reserva', 'reserva')) return done(v + 5, v + 12, 'holds', 'Utiel-Requena Reserva or Gran Reserva: 5 to 12+ years from the vintage.')
    if (has(text, 'crianza', 'roble', 'barrica', 'cepas centenarias', 'centenari')) return done(v + 2, v + 8, 'holds', 'Utiel-Requena Crianza or oak-aged red: 2 to 8 years from the vintage.')
    return done(v + 1, v + 3, 'declines', 'Utiel-Requena joven or without ageing designation: 1 to 3 years from the vintage.')
  }
  if (!utiel && (colour === 'red' || colour === 'white') && (wh.includes('valencia') || wh.includes('alicante'))) {
    if (has(text, 'fondillon')) return done(v + 20, v + 50, 'evolves', 'Fondillón: 20 to 50+ years from the vintage.')
    if (colour === 'white') return done(v + 1, v + 3, 'declines', 'Valencia white or rosé: 1 to 3 years from the vintage.')
    if (has(text, 'gran reserva')) return done(v + 8, v + 20, 'holds', 'Valencia Gran Reserva: 8 to 20+ years from the vintage.')
    if (has(text, 'reserva')) return done(v + 5, v + 12, 'holds', 'Valencia Reserva: 5 to 12 years from the vintage.')
    if (has(text, 'crianza')) return done(v + 3, v + 7, 'holds', 'Valencia Crianza: 3 to 7 years from the vintage.')
    return done(v + 1, v + 3, 'declines', 'Valencia joven or without ageing designation: 1 to 3 years from the vintage.')
  }

  // Italy. The original also reads the shop's ageing text (oak, large casks) for Barbera and Barolo; Lagar has no
  // such field, so only the name-based rules remain.
  const whName = norm(wh + ' ' + name)
  if (colour === 'red' && whName.includes('barbera')) {
    if (has(text, 'castellinaldo')) return done(v + 5, v + 10, 'holds', "Barbera d'Alba Castellinaldo: 5 to 10+ years from the vintage.")
    if (has(text, 'superiore')) return done(v + 5, v + 10, 'holds', 'Barbera Superiore: 5 to 10 years from the vintage.')
    return done(v + 1, v + 3, 'declines', 'Barbera, steel-aged or unoaked: 1 to 3 years from the vintage.')
  }
  if (colour === 'red' && (whName.includes('barolo') || whName.includes('langhe nebbiolo'))) {
    if (!whName.includes('barolo')) return done(v + 2, v + 7, 'holds', 'Langhe Nebbiolo, entry level: 2 to 7 years from the vintage.')
    if (has(text, 'riserva')) return done(v + 15, v + 40, 'holds', 'Barolo Riserva: 15 to 40+ years from the vintage.')
    return done(v + 6, v + 15, 'holds', 'Barolo, style not known (modern band used): 6 to 15 years from the vintage.')
  }
  if (whName.includes('chianti') && colour === 'red') {
    const classico = whName.includes('classico')
    if (has(text, 'gran selezione')) return done(v + 8, v + 20, 'holds', 'Chianti Classico Gran Selezione: 8 to 20+ years from the vintage.')
    if (classico && has(text, 'riserva')) return done(v + 6, v + 15, 'holds', 'Chianti Classico Riserva: 6 to 15 years from the vintage.')
    if (classico) return done(v + 2, v + 7, 'holds', 'Chianti Classico annata: 2 to 7 years from the vintage.')
    if (has(text, 'superiore')) return done(v + 2, v + 5, 'holds', 'Chianti Superiore: 2 to 5 years from the vintage.')
    return done(v + 1, v + 3, 'declines', 'Basic Chianti: 1 to 3 years from the vintage.')
  }

  // Spain
  if (wh.includes('priorat') && (colour === 'red' || colour === 'white')) {
    if (colour === 'white') return done(v + 2, v + 8, 'holds', 'Priorat white: 2 to 8+ years from the vintage; simple ones within 2-4 years.')
    if (has(text, 'vinya classificada', 'gran vinya', 'mogador', 'finca dofi', 'ermita', 'gran clos')) {
      return done(v + 10, v + 25, 'holds', 'Priorat top estate or single vineyard: 10 to 25+ years from the vintage. Category read from the name.')
    }
    if (has(text, 'vi de vila', 'porrera', 'gratallops', 'torroja', 'poboleda', 'bellmunt', 'la vilella', 'escaladei', 'el lloar')) {
      return done(v + 5, v + 12, 'holds', 'Priorat village wine: 5 to 12 years from the vintage, peak around years 6-8. Category read from the name.')
    }
    return done(v + 2, v + 6, 'holds', 'Priorat entry-level or joven red: 2 to 6 years from the vintage.')
  }
  if (wh.includes('manchuela') && (colour === 'red' || colour === 'white' || colour === 'rosé')) {
    if (colour === 'red') {
      if (has(text, 'viejas', 'old vine', 'pie franco', 'p.f', 'crianza', 'reserva', 'centenari')) {
        return done(v + 2, v + 10, 'holds', 'Manchuela old-vine or premium aged red: 2 to 10 years from the vintage, best in years 3-6. Category read from the name.')
      }
      if (has(text, 'joven')) return done(v + 1, v + 2, 'declines', 'Manchuela joven: 1 to 2 years from the vintage.')
      return done(v + 2, v + 5, 'holds', 'Manchuela standard or mid-range red: 2 to 5 years from the vintage, best in years 2-3.')
    }
    if (has(text, 'brisado', 'crianza', 'barrica', 'reserva', 'lias', 'naranja', 'orange')) {
      return done(v + 2, v + 5, 'holds', 'Manchuela aged white or rosé, or skin-contact: 2 to 5 years from the vintage, best in years 2-4.')
    }
    return done(v + 1, v + 2, 'declines', 'Manchuela young white or rosé: 1 to 2 years from the vintage.')
  }
  const ribeiro = wh.includes('ribeiro')
  if (ribeiro && colour === 'red') return done(v + 2, v + 5, 'declines', 'Ribeiro red: 2 to 5 years from the vintage; oak-aged ones can go longer.')
  if (ribeiro && colour === 'white') {
    if (has(text, 'lias', 'sur lie', 'lees')) return done(v + 3, v + 6, 'holds', 'Ribeiro lees-aged white: 3 to 6 years from the vintage.')
    if ((w.grapes ?? '').trim().startsWith('100%') || has(text, 'tostado')) {
      return done(v + 5, v + 10, 'holds', 'Ribeiro premium single-variety white: 5 to 10+ years from the vintage. Counted as single-variety because the grapes are 100% one variety.')
    }
    return done(v + 1, v + 3, 'declines', 'Ribeiro young white: 1 to 3 years from the vintage.')
  }
  if (colour === 'white' && wh.includes('rias baixas')) {
    let a: number, b: number, k: Keeps, note: string
    if (has(text, 'barrica', 'barrel', 'seleccion de anada', 'fermentado en')) [a, b, k, note] = [v + 5, v + 15, 'holds', 'Rías Baixas barrel-aged or Selección de Añada: 5 to 15+ years from the vintage.']
    else if (has(text, 'lias', 'sur lie', 'lees')) [a, b, k, note] = [v + 3, v + 5, 'holds', 'Rías Baixas lees-aged: 3 to 5+ years from the vintage.']
    else [a, b, k, note] = [v + 1, v + 3, 'declines', 'Rías Baixas classic, stainless steel: 1 to 3 years from the vintage, freshest in years 1-2.']
    return done(a, b, k, note + ' Category read from the name.')
  }
  if (colour === 'white') {
    if (has(text, 'vin jaune', 'chateau chalon') || text.includes('vin jaune')) return done(v + 5, v + 50, 'evolves', 'Vin jaune: extremely long-lived, changes slowly.')
    if (has(text, 'tondonia', 'gravonia', 'bosconia', 'heredia')) return done(v + 6, v + 25, 'holds', 'López de Heredia whites age very slowly: from about 6 years up to 25.')
    if (wh.includes('rioja') && !wh.includes('rias baixas')) {
      let a: number, b: number, k: Keeps, n: string
      if (has(text, 'gran reserva')) [a, b, k, n] = [v + 8, v + 20, 'holds', 'Rioja white Gran Reserva: 8 to 20 years from the vintage.']
      else if (has(text, 'reserva')) [a, b, k, n] = [v + 4, v + 15, 'holds', 'Rioja white Reserva: 4 to 15 years from the vintage.']
      else if (has(text, 'crianza', 'barrica', 'fermentado', 'roble')) [a, b, k, n] = [v + 2, v + 8, 'holds', 'Rioja white, oak: 2 to 8 years from the vintage.']
      else [a, b, k, n] = [v + 1, v + 4, 'declines', 'Rioja white, young and fresh: 1 to 4 years from the vintage.']
      return done(a, b, k, n + ' Category read from the name.')
    }
    if (wh.includes('rueda')) {
      let a: number, b: number, k: Keeps, n: string
      if (has(text, 'barrica', 'fermentado', 'roble', 'oak')) [a, b, k, n] = [v + 2, v + 8, 'holds', 'Rueda barrel-fermented or oak-rested: 2 to 8 years from the vintage.']
      else if (has(text, 'lias', 'lees')) [a, b, k, n] = [v + 1, v + 5, 'holds', 'Rueda on the lees: 1 to 5 years from the vintage.']
      else [a, b, k, n] = [v, v + 3, 'declines', 'Rueda joven, stainless steel: 0 to 3 years from the vintage.']
      return done(a, b, k, n + ' Category read from the name.')
    }
    if (has(text, 'riesling', 'chenin')) return done(v + 2, v + 15, 'holds', 'Riesling and chenin: acidity keeps them for 10+ years.')
    if (has(text, 'reserva', 'chardonnay', 'fermentado')) return done(v, v + 8, 'holds', 'White fermented or aged in oak: holds about 8 years.')
    return done(v, v + 4, 'declines', 'Fresh young white: best within about 4 years of the vintage.')
  }

  // reds
  const jumilla = wh.includes('jumilla')
  const ribera = wh.includes('ribera del duero')
  const rioja = wh.includes('rioja')
  let a: number, b: number, note: string
  if (rioja && has(text, 'gran reserva')) [a, b, note] = [v + 10, v + 30, 'Rioja Gran Reserva: 10 to 30+ years from the vintage.']
  else if (rioja && has(text, 'reserva')) [a, b, note] = [v + 6, v + 15, 'Rioja Reserva: 6 to 15 years from the vintage.']
  else if (rioja && has(text, 'crianza')) [a, b, note] = [v + 3, v + 8, 'Rioja Crianza: 3 to 8 years from the vintage.']
  else if (rioja && has(text, 'joven', 'cosecha', 'roble', 'maceracion')) [a, b, note] = [v + 1, v + 3, 'Rioja joven: 1 to 3 years from the vintage.']
  else if (rioja) [a, b, note] = [v + 3, v + 8, 'Rioja without ageing designation, Crianza table used to be safe: 3 to 8 years from the vintage.']
  else if (jumilla && has(text, 'gran reserva')) [a, b, note] = [v + 8, v + 15, 'Jumilla Gran Reserva: 8 to 15+ years from the vintage.']
  else if (jumilla && has(text, 'reserva')) [a, b, note] = [v + 5, v + 12, 'Jumilla Reserva: 5 to 12 years from the vintage.']
  else if (jumilla && has(text, 'crianza')) [a, b, note] = [v + 3, v + 7, 'Jumilla Crianza: 3 to 7 years from the vintage.']
  else if (jumilla) [a, b, note] = [v + 1, v + 3, 'Jumilla joven or without ageing designation: 1 to 3 years from the vintage.']
  else if (ribera && has(text, 'gran reserva')) [a, b, note] = [v + 10, v + 25, 'Ribera del Duero Gran Reserva: 10 to 25+ years from the vintage.']
  else if (ribera && has(text, 'reserva')) [a, b, note] = [v + 6, v + 15, 'Ribera del Duero Reserva: 6 to 15 years from the vintage.']
  else if (ribera && has(text, 'crianza')) [a, b, note] = [v + 3, v + 7, 'Ribera del Duero Crianza: 3 to 7 years from the vintage.']
  else if (ribera && has(text, 'roble', 'barrica')) [a, b, note] = [v + 2, v + 5, 'Ribera del Duero Roble/Barrica: 2 to 5 years from the vintage.']
  else if (ribera && has(text, 'joven', 'cosecha')) [a, b, note] = [v + 1, v + 3, 'Ribera del Duero joven: 1 to 3 years from the vintage.']
  else if (ribera) [a, b, note] = [v + 3, v + 7, 'Ribera del Duero without ageing designation, Crianza table used to be safe: 3 to 7 years from the vintage.']
  else if (has(text, 'gran reserva')) [a, b, note] = [v + 8, v + 28, 'Gran Reserva: ready after long ageing; holds for decades.']
  else if (has(text, 'reserva')) [a, b, note] = [v + 4, v + 17, 'Reserva: best from about 4 years and holds around 14.']
  else if (has(text, 'crianza')) [a, b, note] = [v + 2, v + 11, 'Crianza: best from about 2 years and holds around 10.']
  else if (has(text, 'joven', 'roble')) [a, b, note] = [v, v + 4, 'Young red: drink within about 4 years.']
  else [a, b, note] = [v + 1, v + 11, 'Red without ageing designation: drinks well from year 1, holds about 10.']
  if (has(text, 'tondonia', 'bosconia', 'heredia', 'vega sicilia', 'unico', 'rioja alta', 'gran reserva 904', 'ardanza')) {
    a += 2
    b += 8
    note += ' House known for very long ageing: window extended.'
  }
  if (!(ribera || jumilla) && has(text, 'barolo', 'barbaresco', 'brunello', 'valtuille', 'cepas centenarias', 'priorat', 'ribera del duero')) {
    a += 1
    b += 4
    note += ' Structured appellation: window extended.'
  }
  return done(a, b, 'holds', note)
}

// ---------------------------------------------------------------- putting it together

export function adviceInput(w: Wine): AdviceInput {
  return {
    name: w.name, type: w.type, vintage: w.vintage === 'NV' ? null : w.vintage, region: w.region,
    appellation: w.appellation, grapes: w.grapes, producer: w.producer, lastPurchase: w.purchaseDate,
  }
}

/** The advice for one wine in a given year. The person's own window beats the rules. */
export function adviceFor(wine: Wine, year: number): Advice {
  const own = wine.ownWindow
  if (own && (own.fromYear !== null || own.toYear !== null)) {
    const status = statusFromWindow(own.fromYear, own.toYear, year)
    return { status, fromYear: own.fromYear, toYear: own.toYear, keeps: status === 'drink_now' ? 'declines' : 'holds', source: 'own', note: 'Window set by you.' }
  }
  const input = adviceInput(wine)
  const rule = rules(input, year)
  const advice: Advice = { ...rule, source: 'rule' }
  // A young vintage (the last 4 years) is never "drink now": it is shown as "drink soon".
  if (advice.status === 'drink_now' && input.vintage && input.vintage >= year - (YOUNG_YEARS - 1)) {
    advice.status = 'drink_soon'
    advice.note += ' Young vintage (last 4 years): shown as Drink soon, never Drink now.'
  }
  return advice
}
