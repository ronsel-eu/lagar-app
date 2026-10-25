import { describe, expect, it } from 'vitest'
import { BackupError, backupFilename, createBackup, parseBackup, restoreBackup } from './backup'
import { MemoryStorage } from './storage'
import { makeWine } from './testing'

const valid = () => ({
  app: 'lagar', version: 1, exportedAt: '2026-10-25T10:00:00.000Z',
  wines: [makeWine()],
  opened: [{ id: 'o1', wineId: 'w1', date: '2026-10-24', qty: 1, occasion: null, note: null }],
  settings: { language: 'es' },
})
const parse = (obj: unknown) => parseBackup(JSON.stringify(obj))

describe('backup', () => {
  it('survives a round trip: export, then restore into an empty app', async () => {
    const a = new MemoryStorage()
    await a.putWine(makeWine({ vintage: 'NV', name: 'Viña Tondonia' }))
    await a.setSetting('language', 'fr')
    const file = JSON.stringify(await createBackup(a))
    const b = new MemoryStorage()
    await restoreBackup(b, file)
    expect(await b.snapshot()).toEqual(await a.snapshot())
  })

  it('names the file by date', () => {
    expect(backupFilename(new Date('2026-10-25T10:00:00Z'))).toBe('lagar-backup-2026-10-25.json')
  })

  it('accepts a valid file', () => {
    expect(parse(valid()).wines).toHaveLength(1)
  })

  it('rejects text that is not JSON, and other apps\' files', () => {
    expect(() => parseBackup('hello')).toThrow(BackupError)
    expect(() => parse({ ...valid(), app: 'other' })).toThrow(/not a Lagar backup/)
  })

  it('rejects a backup from a newer version', () => {
    expect(() => parse({ ...valid(), version: 99 })).toThrow(/newer version/)
  })

  it('never turns a bad vintage into NV', () => {
    for (const vintage of [null, '', 'nv', 'abc', 20.5, 5]) {
      const b = valid()
      b.wines = [{ ...makeWine(), vintage } as never]
      expect(() => parse(b), String(vintage)).toThrow(/vintage/)
    }
  })

  it('rejects bad bottle counts and unknown types', () => {
    expect(() => parse({ ...valid(), wines: [{ ...makeWine(), bottles: -1 }] })).toThrow(/bottles/)
    expect(() => parse({ ...valid(), wines: [{ ...makeWine(), bottles: 1.5 }] })).toThrow(/bottles/)
    expect(() => parse({ ...valid(), wines: [{ ...makeWine(), type: 'orange' }] })).toThrow(/unknown type/)
  })

  it('rejects duplicate wines and opened bottles of unknown wines', () => {
    expect(() => parse({ ...valid(), wines: [makeWine(), makeWine()] })).toThrow(/twice/)
    expect(() => parse({ ...valid(), opened: [{ id: 'o1', wineId: 'ghost', date: '2026-10-24', qty: 1 }] })).toThrow(/not in the backup/)
  })

  it('keeps an own drinking window, and accepts older files without one', () => {
    const w = { ...makeWine(), ownWindow: { fromYear: 2024, toYear: null } }
    expect(parse({ ...valid(), wines: [w] }).wines[0].ownWindow).toEqual({ fromYear: 2024, toYear: null })
    const { ownWindow: _unused, ...old } = makeWine()
    expect(parse({ ...valid(), wines: [old] }).wines[0].ownWindow).toBeNull()
  })

  it('rejects an own window that is not years or ends before it starts', () => {
    const bad = (ownWindow: unknown) => parse({ ...valid(), wines: [{ ...makeWine(), ownWindow }] })
    expect(() => bad({ fromYear: 2030, toYear: 2025 })).toThrow(/ends before/)
    expect(() => bad({ fromYear: 'soon', toYear: null })).toThrow(/year/)
    expect(() => bad('2025')).toThrow(/record/)
    expect(bad({ fromYear: null, toYear: null }).wines[0].ownWindow).toBeNull()
  })

  it('keeps only the known fields', () => {
    const b = valid()
    b.wines = [{ ...makeWine(), evil: '<script>', extra: 1 } as never]
    expect(parse(b).wines[0]).toEqual(makeWine())
  })

  it('a bad file changes nothing', async () => {
    const s = new MemoryStorage()
    await s.putWine(makeWine({ id: 'keep' }))
    await expect(restoreBackup(s, '{"app":"lagar","version":1,"wines":[{"id":"x"}],"opened":[]}')).rejects.toThrow(BackupError)
    expect((await s.listWines()).map((w) => w.id)).toEqual(['keep'])
  })
})
