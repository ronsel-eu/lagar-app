import type { OpenedBottle, Snapshot, Wine } from './types'

/** Everything the screens need from storage. The screens only know this interface, so the place where the
 *  data lives (browser database today, native SQLite in the Android and iOS apps later) can change without
 *  touching them. */
export interface LagarStorage {
  listWines(): Promise<Wine[]>
  getWine(id: string): Promise<Wine | undefined>
  putWine(wine: Wine): Promise<void>
  /** Save many wines in one go (used by the CSV import). */
  putWines(wines: Wine[]): Promise<void>
  /** Delete a wine and its opened bottles. */
  deleteWine(id: string): Promise<void>

  listOpened(): Promise<OpenedBottle[]>
  putOpened(opened: OpenedBottle): Promise<void>
  deleteOpened(id: string): Promise<void>

  getSetting(key: string): Promise<string | undefined>
  setSetting(key: string, value: string): Promise<void>

  /** All the data, for a backup. */
  snapshot(): Promise<Snapshot>
  /** Replace all the data (restoring a backup). All or nothing. */
  replaceAll(snapshot: Snapshot): Promise<void>
}

/** A plain copy. The app's screens hold their data in reactive objects (Proxies), which IndexedDB and structuredClone
 *  refuse ("could not be cloned"); everything stored is plain JSON, so a JSON round trip is always safe. */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))

/** Data kept in memory only. Used by the tests, and as a fallback if the browser's database is not available
 *  (some private windows), in which case nothing survives closing the page. */
export class MemoryStorage implements LagarStorage {
  private wines = new Map<string, Wine>()
  private opened = new Map<string, OpenedBottle>()
  private settings = new Map<string, string>()

  async listWines() { return [...this.wines.values()].map(copy) }
  async getWine(id: string) { const w = this.wines.get(id); return w && copy(w) }
  async putWine(wine: Wine) { this.wines.set(wine.id, copy(wine)) }
  async putWines(wines: Wine[]) { for (const w of wines) this.wines.set(w.id, copy(w)) }
  async deleteWine(id: string) {
    this.wines.delete(id)
    for (const [key, o] of this.opened) if (o.wineId === id) this.opened.delete(key)
  }

  async listOpened() { return [...this.opened.values()].map(copy) }
  async putOpened(opened: OpenedBottle) { this.opened.set(opened.id, copy(opened)) }
  async deleteOpened(id: string) { this.opened.delete(id) }

  async getSetting(key: string) { return this.settings.get(key) }
  async setSetting(key: string, value: string) { this.settings.set(key, value) }

  async snapshot(): Promise<Snapshot> {
    return { wines: await this.listWines(), opened: await this.listOpened(), settings: Object.fromEntries(this.settings) }
  }
  async replaceAll(s: Snapshot) {
    this.wines = new Map(s.wines.map((w) => [w.id, copy(w)]))
    this.opened = new Map(s.opened.map((o) => [o.id, copy(o)]))
    this.settings = new Map(Object.entries(s.settings))
  }
}

// ---------------------------------------------------------------- the browser's database (IndexedDB)

const DB_NAME = 'lagar'
const DB_VERSION = 1

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

type Store = 'wines' | 'opened' | 'meta'

export class IndexedDbStorage implements LagarStorage {
  private constructor(private db: IDBDatabase) {}

  static open(factory: IDBFactory = indexedDB, name = DB_NAME): Promise<IndexedDbStorage> {
    return new Promise((resolve, reject) => {
      const r = factory.open(name, DB_VERSION)
      r.onupgradeneeded = () => {
        const db = r.result
        db.createObjectStore('wines', { keyPath: 'id' })
        const opened = db.createObjectStore('opened', { keyPath: 'id' })
        opened.createIndex('wineId', 'wineId')
        db.createObjectStore('meta', { keyPath: 'key' })
      }
      r.onsuccess = () => resolve(new IndexedDbStorage(r.result))
      r.onerror = () => reject(r.error)
    })
  }

  private tx(stores: Store[], mode: IDBTransactionMode = 'readonly') {
    return this.db.transaction(stores, mode)
  }

  listWines() { return request(this.tx(['wines']).objectStore('wines').getAll() as IDBRequest<Wine[]>) }
  getWine(id: string) { return request(this.tx(['wines']).objectStore('wines').get(id) as IDBRequest<Wine | undefined>) }
  async putWine(wine: Wine) { await this.putWines([wine]) }
  async putWines(wines: Wine[]) {
    const tx = this.tx(['wines'], 'readwrite')
    const store = tx.objectStore('wines')
    for (const w of wines) store.put(copy(w))
    await finished(tx)
  }
  async deleteWine(id: string) {
    const tx = this.tx(['wines', 'opened'], 'readwrite')
    tx.objectStore('wines').delete(id)
    const index = tx.objectStore('opened').index('wineId')
    const keys = await request(index.getAllKeys(id))
    for (const key of keys) tx.objectStore('opened').delete(key)
    await finished(tx)
  }

  listOpened() { return request(this.tx(['opened']).objectStore('opened').getAll() as IDBRequest<OpenedBottle[]>) }
  async putOpened(opened: OpenedBottle) {
    const tx = this.tx(['opened'], 'readwrite')
    tx.objectStore('opened').put(copy(opened))
    await finished(tx)
  }
  async deleteOpened(id: string) {
    const tx = this.tx(['opened'], 'readwrite')
    tx.objectStore('opened').delete(id)
    await finished(tx)
  }

  async getSetting(key: string) {
    const row = await request(this.tx(['meta']).objectStore('meta').get(key) as IDBRequest<{ key: string; value: string } | undefined>)
    return row?.value
  }
  async setSetting(key: string, value: string) {
    const tx = this.tx(['meta'], 'readwrite')
    tx.objectStore('meta').put({ key, value })
    await finished(tx)
  }

  async snapshot(): Promise<Snapshot> {
    const tx = this.tx(['wines', 'opened', 'meta'])
    const [wines, opened, meta] = await Promise.all([
      request(tx.objectStore('wines').getAll() as IDBRequest<Wine[]>),
      request(tx.objectStore('opened').getAll() as IDBRequest<OpenedBottle[]>),
      request(tx.objectStore('meta').getAll() as IDBRequest<{ key: string; value: string }[]>),
    ])
    return { wines, opened, settings: Object.fromEntries(meta.map((m) => [m.key, m.value])) }
  }

  /** One transaction: if anything fails, nothing changes. */
  async replaceAll(s: Snapshot) {
    const tx = this.tx(['wines', 'opened', 'meta'], 'readwrite')
    for (const name of ['wines', 'opened', 'meta'] as const) tx.objectStore(name).clear()
    for (const w of s.wines) tx.objectStore('wines').put(copy(w))
    for (const o of s.opened) tx.objectStore('opened').put(copy(o))
    for (const [key, value] of Object.entries(s.settings)) tx.objectStore('meta').put({ key, value })
    await finished(tx)
  }
}

/** Open the browser's database, or fall back to memory (and say so) if it is not available. */
export async function openStorage(): Promise<{ storage: LagarStorage; persistent: boolean }> {
  try {
    return { storage: await IndexedDbStorage.open(), persistent: true }
  } catch {
    return { storage: new MemoryStorage(), persistent: false }
  }
}

/** Ask the browser not to clear our data when space runs low. Only works on https pages, and the browser may say no. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return (await navigator.storage.persisted()) || (await navigator.storage.persist())
  } catch {
    return false
  }
}
