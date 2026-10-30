/** Interface text in English, Spanish, French and Italian. The English wording is the key; a text with no translation is shown in English. */
import { EXTRA } from './extra'
import { IT, IT_PLACES } from './it'
import { PLACES, STRINGS } from './strings'

const lookup = (key: string) => (Object.hasOwn(STRINGS, key) ? STRINGS[key] : Object.hasOwn(EXTRA, key) ? EXTRA[key] : undefined)

export type Lang = 'en' | 'es' | 'fr' | 'it'
export const LANGS: Record<Lang, string> = { en: 'English', es: 'Español', fr: 'Français', it: 'Italiano' }
export const isLang = (s: unknown): s is Lang => typeof s === 'string' && Object.hasOwn(LANGS, s)

type Params = Record<string, string | number>

export function translate(lang: Lang, key: string, params?: Params): string {
  const found = lang === 'en' ? undefined : lang === 'it' ? (Object.hasOwn(IT, key) ? IT[key] : undefined) : lookup(key)?.[lang]
  const text = found ?? key.split('|')[0]
  return params ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`)) : text
}

/** `one` when the count is 1, `other` otherwise. */
export function translatePlural(lang: Lang, count: number, one: string, other: string, params?: Params): string {
  return translate(lang, count === 1 ? one : other, params)
}

/** A country or region in the language; a name with no entry is shown as it is stored. */
export function translatePlace(lang: Lang, name: string | null | undefined): string {
  if (!name) return ''
  if (lang === 'it') return Object.hasOwn(IT_PLACES, name) ? IT_PLACES[name] : name
  return Object.hasOwn(PLACES, name) ? PLACES[name][lang] : name
}

/** The language to start with: the browser's, if it is one of ours. */
export function browserLang(languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages): Lang {
  for (const l of languages) {
    const short = l.slice(0, 2).toLowerCase()
    if (isLang(short)) return short
  }
  return 'en'
}
