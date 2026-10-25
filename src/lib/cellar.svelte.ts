import { openStorage, requestPersistence, type LagarStorage } from './storage'
import type { OpenedBottle, Wine } from './types'
import { browserLang, isLang } from './i18n'
import { ui } from './i18n/ui.svelte'
import { undoOpened } from './wine'

/** What is on this device, loaded once and refreshed after every change. */
export const cellar = $state<{ ready: boolean; persistent: boolean; protectedByBrowser: boolean; wines: Wine[]; opened: OpenedBottle[] }>({
  ready: false, persistent: true, protectedByBrowser: false, wines: [], opened: [],
})

let storage: LagarStorage | undefined

export function getStorage(): LagarStorage {
  if (!storage) throw new Error('The cellar is not open yet.')
  return storage
}

export async function reload() {
  cellar.wines = await getStorage().listWines()
  cellar.opened = await getStorage().listOpened()
}

export async function initCellar() {
  const opened = await openStorage()
  storage = opened.storage
  cellar.persistent = opened.persistent
  cellar.protectedByBrowser = await requestPersistence()
  const saved = await storage.getSetting('language')
  ui.lang = isLang(saved) ? saved : browserLang()
  await reload()
  cellar.ready = true
}

/** Undo: remove the record of an opened bottle and give the bottles back to the stock. */
export async function undoOpenedBottle(recordId: string) {
  const record = cellar.opened.find((o) => o.id === recordId)
  const wine = record && cellar.wines.find((w) => w.id === record.wineId)
  if (!record || !wine) return
  await getStorage().putWine(undoOpened(wine, record))
  await getStorage().deleteOpened(record.id)
  await reload()
}

export async function setLanguage(lang: typeof ui.lang) {
  ui.lang = lang
  await getStorage().setSetting('language', lang)
}
