import { translate, translatePlace, translatePlural, type Lang } from './index'

/** The language of the interface. Reading it inside a component makes the component update when it changes. */
export const ui = $state<{ lang: Lang }>({ lang: 'en' })

export const t = (key: string, params?: Record<string, string | number>) => translate(ui.lang, key, params)
export const tn = (count: number, one: string, other: string) => translatePlural(ui.lang, count, one, other)
export const place = (name: string | null | undefined) => translatePlace(ui.lang, name)
