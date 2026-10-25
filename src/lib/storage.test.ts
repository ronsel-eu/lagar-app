import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { IndexedDbStorage, MemoryStorage, type LagarStorage } from './storage'
import { makeWine } from './testing'

// The same checks run against both storages, so they behave the same.
const storages: [string, () => Promise<LagarStorage>][] = [
  ['memory', async () => new MemoryStorage()],
  ['indexeddb', () => IndexedDbStorage.open(new IDBFactory())],
]

describe.each(storages)('%s storage', (_name, create) => {
  it('starts empty', async () => {
    const s = await create()
    expect(await s.snapshot()).toEqual({ wines: [], opened: [], settings: {} })
  })

  it('saves, reads and replaces a wine by id', async () => {
    const s = await create()
    await s.putWine(makeWine())
    expect(await s.getWine('w1')).toEqual(makeWine())
    await s.putWine(makeWine({ bottles: 1 }))
    expect((await s.listWines()).length).toBe(1)
    expect((await s.getWine('w1'))?.bottles).toBe(1)
    expect(await s.getWine('nope')).toBeUndefined()
  })

  it('saves many wines at once', async () => {
    const s = await create()
    await s.putWines([makeWine({ id: 'a' }), makeWine({ id: 'b' }), makeWine({ id: 'c' })])
    expect((await s.listWines()).map((w) => w.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('keeps and removes opened bottles', async () => {
    const s = await create()
    await s.putWine(makeWine())
    await s.putOpened({ id: 'o1', wineId: 'w1', date: '2026-10-24', qty: 1, occasion: null, note: null })
    expect(await s.listOpened()).toHaveLength(1)
    await s.deleteOpened('o1')
    expect(await s.listOpened()).toHaveLength(0)
  })

  it('deleting a wine also deletes its opened bottles, and only its own', async () => {
    const s = await create()
    await s.putWines([makeWine({ id: 'a' }), makeWine({ id: 'b' })])
    await s.putOpened({ id: 'o1', wineId: 'a', date: '2026-10-24', qty: 1, occasion: null, note: null })
    await s.putOpened({ id: 'o2', wineId: 'b', date: '2026-10-24', qty: 1, occasion: null, note: null })
    await s.deleteWine('a')
    expect((await s.listWines()).map((w) => w.id)).toEqual(['b'])
    expect((await s.listOpened()).map((o) => o.id)).toEqual(['o2'])
  })

  it('stores settings', async () => {
    const s = await create()
    expect(await s.getSetting('language')).toBeUndefined()
    await s.setSetting('language', 'es')
    expect(await s.getSetting('language')).toBe('es')
  })

  it('replaceAll swaps everything for the snapshot', async () => {
    const s = await create()
    await s.putWine(makeWine({ id: 'old' }))
    await s.setSetting('language', 'fr')
    await s.replaceAll({
      wines: [makeWine({ id: 'new' })],
      opened: [{ id: 'o1', wineId: 'new', date: '2026-10-24', qty: 2, occasion: 'dinner', note: null }],
      settings: { language: 'en' },
    })
    const snap = await s.snapshot()
    expect(snap.wines.map((w) => w.id)).toEqual(['new'])
    expect(snap.opened[0].qty).toBe(2)
    expect(snap.settings).toEqual({ language: 'en' })
  })
})
