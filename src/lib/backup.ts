import { BACKUP_VERSION, WINE_TYPES, type Backup, type OpenedBottle, type OwnWindow, type Snapshot, type Wine, type WineType } from './types'
import type { LagarStorage } from './storage'

export class BackupError extends Error {}

type Raw = Record<string, unknown>
const isObject = (x: unknown): x is Raw => typeof x === 'object' && x !== null && !Array.isArray(x)

function text(raw: Raw, key: string, where: string, required = false): string | null {
  const v = raw[key]
  if (v === undefined || v === null || v === '') {
    if (required) throw new BackupError(`${where}: "${key}" is missing`)
    return null
  }
  if (typeof v !== 'string') throw new BackupError(`${where}: "${key}" must be text`)
  return v
}

function number(raw: Raw, key: string, where: string, min = 0): number | null {
  const v = raw[key]
  if (v === undefined || v === null) return null
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min) throw new BackupError(`${where}: "${key}" must be a number of ${min} or more`)
  return v
}

function ownWindowFrom(raw: Raw, where: string): OwnWindow | null {
  const v = raw.ownWindow
  if (v === undefined || v === null) return null   // older files have no such field
  if (!isObject(v)) throw new BackupError(`${where}: "ownWindow" must be a record`)
  const year = (key: string) => {
    const y = v[key]
    if (y === undefined || y === null) return null
    if (typeof y !== 'number' || !Number.isInteger(y) || y < 1000 || y > 2300) throw new BackupError(`${where}: "ownWindow.${key}" must be a year`)
    return y
  }
  const fromYear = year('fromYear')
  const toYear = year('toYear')
  if (fromYear === null && toYear === null) return null
  if (fromYear !== null && toYear !== null && fromYear > toYear) throw new BackupError(`${where}: the own window ends before it starts`)
  return { fromYear, toYear }
}

function wineFrom(raw: unknown, i: number): Wine {
  const where = `wine ${i + 1}`
  if (!isObject(raw)) throw new BackupError(`${where}: not a record`)
  const vintage = raw.vintage
  if (vintage !== 'NV' && !(typeof vintage === 'number' && Number.isInteger(vintage) && vintage >= 1000 && vintage <= 2200))
    throw new BackupError(`${where}: "vintage" must be a year or NV`)
  const bottles = raw.bottles
  if (typeof bottles !== 'number' || !Number.isInteger(bottles) || bottles < 0) throw new BackupError(`${where}: "bottles" must be a whole number, 0 or more`)
  const type = text(raw, 'type', where)
  if (type !== null && !(WINE_TYPES as readonly string[]).includes(type)) throw new BackupError(`${where}: unknown type "${type}"`)
  // Built from the known fields only, so a file with extra or odd fields cannot put anything else in the app.
  return {
    id: text(raw, 'id', where, true)!,
    name: text(raw, 'name', where, true)!,
    vintage,
    bottles,
    type: type as WineType | null,
    producer: text(raw, 'producer', where),
    country: text(raw, 'country', where),
    region: text(raw, 'region', where),
    appellation: text(raw, 'appellation', where),
    grapes: text(raw, 'grapes', where),
    abv: number(raw, 'abv', where),
    formatCl: number(raw, 'formatCl', where),
    paid: number(raw, 'paid', where),
    criticPoints: number(raw, 'criticPoints', where),
    criticName: text(raw, 'criticName', where),
    purchaseDate: text(raw, 'purchaseDate', where),
    addedAt: text(raw, 'addedAt', where, true)!,
    ownWindow: ownWindowFrom(raw, where),
    servingTemperature: text(raw, 'servingTemperature', where),
    foodPairing: text(raw, 'foodPairing', where),
    tastingAppearance: text(raw, 'tastingAppearance', where),
    tastingNose: text(raw, 'tastingNose', where),
    tastingPalate: text(raw, 'tastingPalate', where),
    criticsOpinion: text(raw, 'criticsOpinion', where),
  }
}

function openedFrom(raw: unknown, i: number): OpenedBottle {
  const where = `opened bottle ${i + 1}`
  if (!isObject(raw)) throw new BackupError(`${where}: not a record`)
  const qty = raw.qty
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) throw new BackupError(`${where}: "qty" must be a whole number, 1 or more`)
  return {
    id: text(raw, 'id', where, true)!,
    wineId: text(raw, 'wineId', where, true)!,
    date: text(raw, 'date', where, true)!,
    qty,
    occasion: text(raw, 'occasion', where),
    note: text(raw, 'note', where),
  }
}

/** Read and check a backup file. Throws a BackupError with a readable message if anything is wrong,
 *  before anything in the app is touched. */
export function parseBackup(fileText: string): Snapshot {
  let data: unknown
  try {
    data = JSON.parse(fileText)
  } catch {
    throw new BackupError('This is not a Lagar backup (the file could not be read).')
  }
  if (!isObject(data) || data.app !== 'lagar') throw new BackupError('This is not a Lagar backup.')
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION)
    throw new BackupError('This backup comes from a newer version of Lagar. Update the app first.')
  if (!Array.isArray(data.wines) || !Array.isArray(data.opened)) throw new BackupError('The backup has no wines list.')

  const wines = data.wines.map(wineFrom)
  const ids = new Set<string>()
  for (const w of wines) {
    if (ids.has(w.id)) throw new BackupError(`The same wine appears twice in the backup ("${w.name}").`)
    ids.add(w.id)
  }
  const opened = data.opened.map(openedFrom)
  const openedIds = new Set<string>()
  for (const o of opened) {
    if (openedIds.has(o.id)) throw new BackupError('The same opened bottle appears twice in the backup.')
    openedIds.add(o.id)
    if (!ids.has(o.wineId)) throw new BackupError('An opened bottle points to a wine that is not in the backup.')
  }
  const settings: Record<string, string> = {}
  if (isObject(data.settings)) for (const [k, v] of Object.entries(data.settings)) if (typeof v === 'string') settings[k] = v
  return { wines, opened, settings }
}

export async function createBackup(storage: LagarStorage, now = new Date()): Promise<Backup> {
  return { app: 'lagar', version: BACKUP_VERSION, exportedAt: now.toISOString(), ...(await storage.snapshot()) }
}

/** Check the file first, then replace everything. A bad file changes nothing. */
export async function restoreBackup(storage: LagarStorage, fileText: string): Promise<Snapshot> {
  const snapshot = parseBackup(fileText)
  await storage.replaceAll(snapshot)
  return snapshot
}

export function backupFilename(now = new Date()): string {
  return `lagar-backup-${now.toISOString().slice(0, 10)}.json`
}

/** Hand the backup to the person as a file download. */
export function downloadBackup(backup: Backup, now = new Date()) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFilename(now)
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
