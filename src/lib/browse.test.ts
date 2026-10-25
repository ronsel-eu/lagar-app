import { describe, expect, it } from 'vitest'
import { browse, homePicks, homeStats, parseGrapes, searchCellar, sortRows, toRows, type Row } from './browse'
import { makeWine } from './testing'
import type { OpenedBottle, Wine } from './types'

const YEAR = 2026
// Windows to control the status: now / soon / later / keep
const NOW = { fromYear: 2015, toYear: 2025 }
const SOON = { fromYear: 2015, toYear: 2027 }
const LATER = { fromYear: 2015, toYear: 2040 }
const KEEP = { fromYear: 2035, toYear: 2045 }

const wine = (id: string, o: Partial<Wine> = {}) => makeWine({ id, name: 'Wine ' + id, ownWindow: LATER, ...o })
const rowsOf = (wines: Wine[], opened: OpenedBottle[] = []) => toRows(wines, opened, YEAR)
const opened = (wineId: string, qty = 1): OpenedBottle => ({ id: 'o' + wineId + qty, wineId, date: '2026-01-01', qty, occasion: null, note: null })
const ids = (rows: Row[]) => rows.map((r) => r.id)

describe('statuses used by the tests', () => {
  it('own windows give the status we expect', () => {
    const s = (w: Wine['ownWindow']) => rowsOf([wine('a', { ownWindow: w })])[0].status
    expect([s(NOW), s(SOON), s(LATER), s(KEEP)]).toEqual(['drink_now', 'drink_soon', 'can_wait', 'keep'])
  })
})

describe('grapes', () => {
  it('lists one entry per variety, without percentages or "others"', () => {
    expect(parseGrapes('60% Garnacha, 15% Monastrell, 25% Autres')).toEqual(['Garnacha', 'Monastrell'])
    expect(parseGrapes('Syrah et Grenache')).toEqual(['Syrah', 'Grenache'])
    expect(parseGrapes('Tempranillo and Graciano')).toEqual(['Tempranillo', 'Graciano'])
    expect(parseGrapes('100% Riesling')).toEqual(['Riesling'])
    expect(parseGrapes(null)).toEqual([])
    expect(parseGrapes('12,5')).toEqual([])
  })
  it('merges Palomino into Palomino fino', () => {
    expect(parseGrapes('Palomino')).toEqual(['Palomino fino'])
    expect(parseGrapes('Palomino fino, Palomino')).toEqual(['Palomino fino'])
  })
})

describe('order', () => {
  const rows = rowsOf([
    wine('a', { name: 'Alfa', purchaseDate: '2024-05-01', paid: 20 }),
    wine('b', { name: 'Beta', purchaseDate: '2026-01-01', paid: 10 }),
    wine('c', { name: 'Gamma', purchaseDate: null, paid: null }),
    wine('d', { name: 'Delta', purchaseDate: '2020-01-01', paid: 30 }),
  ])
  it('newest and oldest purchase, missing dates last', () => {
    expect(ids(sortRows(rows, 'recent'))).toEqual(['b', 'a', 'd', 'c'])
    expect(ids(sortRows(rows, 'oldest'))).toEqual(['d', 'a', 'b', 'c'])
  })
  it('price both ways, missing prices last', () => {
    expect(ids(sortRows(rows, 'price_high'))).toEqual(['d', 'a', 'b', 'c'])
    expect(ids(sortRows(rows, 'price_low'))).toEqual(['b', 'a', 'd', 'c'])
  })
  it('critic points, best first, missing last', () => {
    const scored = rowsOf([
      wine('a', { name: 'A', criticPoints: 90 }), wine('b', { name: 'B', criticPoints: 96 }),
      wine('c', { name: 'C', criticPoints: null }), wine('d', { name: 'D', criticPoints: 90 }),
    ])
    expect(ids(sortRows(scored, 'points'))).toEqual(['b', 'a', 'd', 'c'])
    expect(browse(scored, { sort: 'points' }).sort).toBe('points')
  })
  it('breaks ties by name, ignoring accents and case', () => {
    const tie = rowsOf([wine('1', { name: 'Éclat', purchaseDate: '2024-01-01' }), wine('2', { name: 'abc', purchaseDate: '2024-01-01' })])
    expect(ids(sortRows(tie, 'recent'))).toEqual(['2', '1'])
  })
})

describe('Wines page', () => {
  const wines = [
    wine('r1', { name: 'Rioja One', country: 'Spain', region: 'Rioja', appellation: 'Rioja', vintage: 2015, grapes: 'Tempranillo', ownWindow: NOW }),
    wine('r2', { name: 'Rioja Two', country: 'Spain', region: 'Rioja', appellation: 'Rioja', vintage: 2016, grapes: 'Tempranillo, Graciano' }),
    wine('w1', { name: 'Albariño', country: 'Spain', region: 'Galicia', appellation: 'Rías Baixas', type: 'white', vintage: 2023, grapes: 'Albariño' }),
    wine('f1', { name: 'Chablis', country: 'France', region: 'Borgoña', appellation: 'Chablis', type: 'white', vintage: 2020, grapes: 'Chardonnay' }),
    wine('n1', { name: 'Cava', country: 'Spain', region: 'Cataluña', type: 'sparkling', vintage: 'NV', grapes: null }),
    wine('x1', { name: 'Drunk', bottles: 0, country: 'Italy', region: 'Piamonte', vintage: 2010 }),
    wine('b1', { name: 'Both', bottles: 2, country: 'Spain', vintage: 2012 }),
  ]
  const all = rowsOf(wines, [opened('x1'), opened('b1', 3)])

  it('shows the wines in the cellar by default, newest purchase first', () => {
    const b = browse(all, {})
    expect(b.state).toBe('present')
    expect(b.sort).toBe('recent')
    expect(ids(b.rows)).not.toContain('x1')
    expect(b.rows).toHaveLength(6)
    expect(b.bottles).toBe(b.rows.reduce((n, r) => n + r.bottles, 0))
  })
  it('opened and both', () => {
    expect(ids(browse(all, { state: 'opened' }).rows).sort()).toEqual(['b1', 'x1'])
    expect(browse(all, { state: 'both' }).rows).toHaveLength(7)
    expect(all.find((r) => r.id === 'b1')!.openedN).toBe(3)
  })
  it('ignores a state, sort or status it does not know', () => {
    const b = browse(all, { state: 'nonsense', sort: 'nonsense', status: 'nonsense' })
    expect([b.state, b.sort, b.status]).toEqual(['present', 'recent', ''])
  })
  it('filters by status', () => {
    expect(ids(browse(all, { status: 'drink_now' }).rows)).toEqual(['r1'])
  })
  it('counts every choice given the other filters', () => {
    const b = browse(all, { selection: { country: 'Spain' } })
    expect(b.options.country.map((o) => [o.value, o.count])).toEqual([['Spain', 5], ['France', 1]]) // own choice is not narrowed by itself
    expect(b.options.appellation.map((o) => [o.value, o.count])).toEqual([['Rías Baixas', 1], ['Rioja', 4]]) // r1, r2, the cava and b1 carry the default appellation; France's Chablis no longer fits
    expect(b.options.colour.map((o) => o.value)).toEqual(['red', 'sparkling', 'white']) // ties by name
  })
  it('puts years newest first and NV last, and drops a choice that no longer fits', () => {
    const b = browse(all, { selection: { year: 'nv', country: 'France' } })
    // Cava is Spanish, so France + NV gives nothing: the later filter is dropped, the earlier one kept
    expect(b.selection.country === '' || b.selection.year === '').toBe(true)
    const years = browse(all, {}).options.year.map((o) => o.value)
    expect(years[years.length - 1]).toBe('nv')
    expect(years.slice(0, -1)).toEqual([...years.slice(0, -1)].sort((a, c) => Number(c) - Number(a)))
  })
  it('filters by grape, one entry per variety', () => {
    const b = browse(all, { selection: { grape: 'Graciano' } })
    expect(ids(b.rows)).toEqual(['r2'])
    expect(browse(all, {}).options.grape.find((o) => o.value === 'Tempranillo')!.count).toBe(3) // r1, r2 and b1
  })
  it('filters by type and vintage', () => {
    expect(ids(browse(all, { selection: { colour: 'white' } }).rows).sort()).toEqual(['f1', 'w1'])
    expect(ids(browse(all, { selection: { year: '2016' } }).rows)).toEqual(['r2'])
    expect(ids(browse(all, { selection: { year: 'nv' } }).rows)).toEqual(['n1'])
  })
})

describe('Home', () => {
  const rng = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const many = [
    ...[1, 2, 3, 4].map((i) => wine('rn' + i, { type: 'red', ownWindow: NOW, vintage: 2012 })),
    ...[1, 2].map((i) => wine('rs' + i, { type: 'red', ownWindow: SOON, vintage: 2014 })),
    wine('ry', { type: 'red', ownWindow: LATER, vintage: 2024 }),
    ...[1, 2, 3].map((i) => wine('rl' + i, { type: 'red', ownWindow: LATER, vintage: 2015 })),
    ...[1, 2].map((i) => wine('wn' + i, { type: 'white', ownWindow: NOW, vintage: 2019 })),
    wine('ws', { type: 'white', ownWindow: SOON, vintage: 2020 }),
    wine('wy', { type: 'white', ownWindow: LATER, vintage: 2025 }),
    wine('wl', { type: 'white', ownWindow: LATER, vintage: 2018 }),
    wine('gone', { type: 'red', ownWindow: NOW, bottles: 0 }),
  ]
  const rows = rowsOf(many)

  it('counts bottles, wines, drink now and the cost of what is in the cellar', () => {
    const s = homeStats(rowsOf([
      wine('a', { bottles: 2, paid: 10, ownWindow: NOW }),
      wine('b', { bottles: 3, paid: null }),
      wine('c', { bottles: 0, paid: 99, ownWindow: NOW }),
    ]))
    expect(s).toMatchObject({ bottles: 5, wines: 2, drinkNow: 1, cost: 20, unpriced: 1, empty: false })
    expect(homeStats([]).empty).toBe(true)
  })
  it('suggests 3 red and 3 white, tagged now / soon / young, never a wine that is gone', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = homePicks(rows, YEAR, rng(seed))
      expect(p.red).toHaveLength(3)
      expect(p.white).toHaveLength(3)
      expect(p.red.map((r) => r.tag).slice(0, 3)).toEqual(['now', 'soon', 'young'])
      expect(p.white.map((r) => r.tag).slice(0, 3)).toEqual(['now', 'soon', 'young'])
      expect(new Set(p.red.map((r) => r.id)).size).toBe(3)
      expect([...p.red, ...p.white, ...p.now].some((r) => r.id === 'gone')).toBe(false)
      expect(p.red.every((r) => r.type === 'red')).toBe(true)
    }
  })
  it('picks 2 red and 1 white to drink now', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = homePicks(rows, YEAR, rng(seed))
      expect(p.now.map((r) => r.type)).toEqual(['red', 'red', 'white'])
      expect(p.now.every((r) => r.status === 'drink_now')).toBe(true)
    }
  })
  it('changes with the random source', () => {
    const seen = new Set(Array.from({ length: 12 }, (_, i) => ids(homePicks(rows, YEAR, rng(i + 1)).now).join()))
    expect(seen.size).toBeGreaterThan(1)
  })
  it('copes with a tiny cellar', () => {
    const p = homePicks(rowsOf([wine('only', { type: 'rosé', ownWindow: NOW })]), YEAR, rng())
    expect([p.red.length, p.white.length]).toEqual([0, 0])
    expect(ids(p.now)).toEqual(['only'])
    expect(homePicks([], YEAR, rng())).toEqual({ red: [], white: [], now: [] })
  })
  it('fills the suggestions from the other wines when there is no soon or young one', () => {
    const p = homePicks(rowsOf([1, 2, 3, 4].map((i) => wine('x' + i, { type: 'red', ownWindow: LATER, vintage: 2010 }))), YEAR, rng())
    expect(p.red).toHaveLength(3)
    expect(p.red.every((r) => r.tag === '')).toBe(true)
  })
})

describe('Home search', () => {
  const wines = [
    wine('a', { name: 'Viña Tondonia', producer: 'López de Heredia', appellation: 'Rioja' }),
    wine('b', { name: 'Albariño Fefiñanes', producer: 'Palacio', grapes: 'Albariño' }),
    wine('c', { name: 'Tondonia Blanco', bottles: 0 }),
  ]
  const rows = rowsOf(wines)
  it('finds by name, producer, appellation or grape, ignoring accents and case', () => {
    expect(ids(searchCellar(rows, wines, 'VINA'))).toEqual(['a'])
    expect(ids(searchCellar(rows, wines, 'lopez'))).toEqual(['a'])
    expect(ids(searchCellar(rows, wines, 'albarino'))).toEqual(['b'])
  })
  it('only looks at wines still in the cellar', () => {
    expect(ids(searchCellar(rows, wines, 'tondonia'))).toEqual(['a'])
  })
  it('finds nothing for an empty search', () => {
    expect(searchCellar(rows, wines, '  ')).toEqual([])
  })
})
