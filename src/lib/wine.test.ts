import { describe, expect, it } from 'vitest'
import { adviceFor } from './advice/engine'
import { drinkView, formFrom, nameParts, openBottle, todayIso, undoOpened, wineFromForm } from './wine'
import { makeWine } from './testing'

describe('name band', () => {
  it('splits prefix, main word and suffix like the original', () => {
    expect(nameParts('Viña Tondonia Reserva 2004')).toMatchObject({ pre: { text: 'Viña' }, main: { text: 'Tondonia' }, post: { text: 'Reserva' } })
    expect(nameParts('Pazo de Marés')).toMatchObject({ pre: { text: 'Pazo de' }, main: { text: 'Marés' }, post: null })
    expect(nameParts('Cava Brut Nature Reserva')).toMatchObject({ pre: { text: 'Cava Brut' }, main: { text: 'Nature' }, post: { text: 'Reserva' } })
    expect(nameParts('Sidra')).toMatchObject({ pre: null, main: { text: 'Sidra' }, post: null })
    expect(nameParts('')).toMatchObject({ pre: null, main: { text: '' }, post: null })
  })
  it('on a tie the first long word is the main one', () => {
    expect(nameParts('Alfa Beta').main.text).toBe('Alfa')
  })
  it('sizes the small lines and the main word', () => {
    expect(nameParts('Viña Tondonia').pre).toEqual({ text: 'Viña', size: 22, tracking: '0.34em' })
    expect(nameParts('Domaine des Pierres Blanches Premier').pre!.size).toBe(17)
    const long = nameParts('Extraordinarily').main.size
    expect(long).toBeGreaterThanOrEqual(26)
    expect(nameParts('Sol').main.size).toBe(57)
  })
})

describe('drink block', () => {
  const a = (o: Parameters<typeof makeWine>[0]) => adviceFor(makeWine(o), 2026)
  it('shows the word and the end of the window', () => {
    const v = drinkView(a({ ownWindow: { fromYear: 2015, toYear: 2040 } }))
    expect(v.word).toBe('Can wait')
    expect(v.until).toEqual({ key: 'until {year}', year: 2040 })
    expect(v.source).toBe('your own decision')
    expect(v.note).toBeNull()
  })
  it('keep shows when it starts', () => {
    const v = drinkView(a({ ownWindow: { fromYear: 2035, toYear: 2045 } }))
    expect([v.word, v.until]).toEqual(['Keep', { key: 'from {year}', year: 2035 }])
  })
  it('a style rule with a window is read from the years; the table is the source', () => {
    const v = drinkView(a({ name: 'Bodegas Altamira Gran Reserva', vintage: 2010, ownWindow: null }))
    expect(v.source).toBe('general style rules')
    expect(v.note).toBeNull()
    expect(v.until).not.toBeNull()
  })
  it('says the Consejo Regulador for sherry', () => {
    const v = drinkView(a({ name: 'Fino La Salina', type: 'fortified', vintage: 'NV', region: 'Jerez', appellation: 'Jerez-Xérès-Sherry', grapes: 'Palomino', ownWindow: null }))
    expect(v.source).toBe('the Consejo Regulador')
  })
  it('a wine with no window keeps the note that explains why', () => {
    const v = drinkView(a({ name: 'Mystery', type: null, appellation: null, region: null, country: 'Chile', grapes: null, producer: null, vintage: 2019, ownWindow: null }))
    if (v.until === null) expect(v.note).toBeTruthy()
  })
})

describe('wine form', () => {
  const ok = (over: Partial<ReturnType<typeof formFrom>> = {}) => wineFromForm({ ...formFrom(null), name: 'Test', vintage: '2019', bottles: '2', ...over }, null, 'en')

  it('builds a new wine', () => {
    const r = ok({ type: 'red', paid: '12,50', producer: ' Casa ', formatCl: '150', abv: '14,5', criticPoints: '93', purchaseDate: '2026-03-04' })
    expect(r.error).toBeUndefined()
    expect(r.wine).toMatchObject({
      name: 'Test', vintage: 2019, bottles: 2, type: 'red', paid: 12.5, producer: 'Casa', formatCl: 150, abv: 14.5,
      criticPoints: 93, purchaseDate: '2026-03-04', ownWindow: null,
    })
    expect(r.wine!.id).toBeTruthy()
  })
  it('NV is typed, never guessed: an empty vintage is an error', () => {
    expect(ok({ vintage: 'nv' }).wine!.vintage).toBe('NV')
    expect(ok({ vintage: '' }).error).toMatch(/vintage is required/)
    expect(ok({ vintage: '19' }).error).toMatch(/vintage must be/)
  })
  it('needs a name and sensible numbers', () => {
    expect(ok({ name: '  ' }).error).toMatch(/needs a name/)
    expect(ok({ bottles: 'two' }).error).toMatch(/must be numbers/)
    expect(ok({ bottles: '-1' }).error).toMatch(/cannot be negative/)
    expect(ok({ formatCl: '0' }).error).toMatch(/must be numbers/)
    expect(ok({ bottles: '' }).wine!.bottles).toBe(0)
  })
  it('checks points and the purchase date', () => {
    expect(ok({ criticPoints: '120' }).error).toMatch(/50 to 100/)
    expect(ok({ criticPoints: '17/20' }).error).toMatch(/50 to 100/)
    expect(ok({ purchaseDate: '2026-02-31' }).error).toMatch(/purchase date/)
    expect(ok({ purchaseDate: '' }).wine!.purchaseDate).toBeNull()
  })
  it('sets and checks the own window', () => {
    expect(ok({ windowFrom: '2024', windowTo: '2030' }).wine!.ownWindow).toEqual({ fromYear: 2024, toYear: 2030 })
    expect(ok({ windowFrom: '2024' }).wine!.ownWindow).toEqual({ fromYear: 2024, toYear: null })
    expect(ok({ windowTo: '2030' }).wine!.ownWindow).toEqual({ fromYear: null, toYear: 2030 })
    expect(ok({}).wine!.ownWindow).toBeNull()
    expect(ok({ windowFrom: '2030', windowTo: '2024' }).error).toMatch(/window years/)
    expect(ok({ windowFrom: '24' }).error).toMatch(/window years/)
  })
  it('reads numbers and empty boxes that arrive as numbers or nothing', () => {
    const raw = { ...formFrom(null), name: 'T', vintage: '2019', bottles: 3 as unknown as string, paid: null as unknown as string }
    expect(wineFromForm(raw, null, 'en').wine).toMatchObject({ bottles: 3, paid: null })
    expect(wineFromForm({ ...raw, bottles: null as unknown as string }, null, 'en').wine!.bottles).toBe(0)
  })
  it('reports errors in the language of the interface', () => {
    expect(wineFromForm({ ...formFrom(null), name: '' }, null, 'es').error).toBe('El vino necesita un nombre.')
    expect(wineFromForm({ ...formFrom(null), name: 'x', vintage: '2019', criticPoints: '5' }, null, 'fr').error).toMatch(/50 à 100/)
  })
  it('keeps the id and the date added when editing, and round-trips every field', () => {
    const base = makeWine({ id: 'keep-me', addedAt: '2025-01-01T10:00:00.000Z', criticsOpinion: 'old', ownWindow: { fromYear: 2020, toYear: 2030 }, criticPoints: 91.5, abv: 13.5, paid: 7.9 })
    const r = wineFromForm(formFrom(base), base, 'en')
    expect(r.wine).toEqual(base)
  })
  it('round-trips a wine with everything empty', () => {
    const base = makeWine({
      vintage: 'NV', type: null, producer: null, country: null, region: null, appellation: null, grapes: null, abv: null, formatCl: null, paid: null,
      purchaseDate: null, ownWindow: null,
    })
    expect(wineFromForm(formFrom(base), base, 'en').wine).toEqual(base)
  })
})

describe('opening a bottle', () => {
  const wine = (bottles: number) => makeWine({ id: 'w', bottles })
  const open = (bottles: number, qty = 1, over = {}) => openBottle(wine(bottles), { date: '2026-10-25', qty, occasion: '  Dinner ', note: '', ...over })

  it('lowers the stock and keeps a record', () => {
    const r = open(5)
    expect(r.ok && r.wine.bottles).toBe(4)
    expect(r.ok && r.record).toMatchObject({ wineId: 'w', date: '2026-10-25', qty: 1, occasion: 'Dinner', note: null })
  })
  it('says how many are left', () => {
    expect(open(1).say.key).toBe('Enjoy! A pity this was your last bottle.')
    expect(open(2).say.key).toBe('Enjoy! One bottle left for a special occasion.')
    expect(open(6).say).toEqual({ key: 'Enjoy! Still {n} to share with friends!', params: { n: 5 } })
    expect(open(6, 3).say).toEqual({ key: 'Enjoy! Marked {n} bottles as opened.', params: { n: 3 } })
  })
  it('asks you to wait for a better occasion when you try to open more than you have', () => {
    expect(open(0)).toEqual({ ok: false, say: { key: 'No bottles of this wine left.' } })
    expect(open(1, 2).say.key).toBe('Still one bottle. Look for a nice occasion!')
    expect(open(3, 4).say).toEqual({ key: 'Only {n} bottles of this wine. Look for a nice occasion!', params: { n: 3 } })
  })
  it('checks the date and the number', () => {
    expect(open(3, 1, { date: '2026-13-01' }).say.key).toBe('That date is not valid.')
    expect(open(3, 1, { date: '' }).say.key).toBe('That date is not valid.')
    expect(open(3, 0).say.key).toBe('Enter at least 1 bottle.')
    expect(open(3, 1.5).say.key).toBe('Enter at least 1 bottle.')
  })
  it('undo gives the bottles back', () => {
    const r = open(5, 2)
    if (!r.ok) throw new Error('expected ok')
    expect(undoOpened(r.wine, r.record).bottles).toBe(5)
  })
  it("today is the person's own date", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(todayIso(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31')
  })
})
