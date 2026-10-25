/** The guides: short reference pages bundled with the app, one markdown file per language (slug.es.md, slug.fr.md). */
import type { Lang } from '../i18n'
import { renderMarkdown, splitFrontMatter, type Heading } from './markdown'

const FILES = import.meta.glob('../../guides/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

// words in a wine's drinking-advice note -> the section of the consumption-windows guide
const SECTIONS: [string, string][] = [
  ['utiel', 'utiel-requena'], ['riesling', 'riesling'], ['rioja', 'rioja'], ['ribera del duero', 'ribera-del-duero'],
  ['rias baixas', 'rias-baixas'], ['rueda', 'rueda'], ['ribeiro', 'ribeiro'], ['bierzo', 'bierzo'], ['jumilla', 'jumilla'],
  ['manchuela', 'manchuela'], ['valencia', 'valencia'], ['fondillon', 'valencia'], ['priorat', 'priorat'],
  ['chianti', 'chianti'], ['barolo', 'barolo'], ['langhe nebbiolo', 'barolo'], ['barbera', 'barbera'],
  ['cava', 'cava'], ['champagne', 'champagne'], ['port', 'port'], ['bordeaux', 'bordeaux'], ['sherry', 'sherry'],
]

/** The section of the consumption-windows guide that a style-rule note comes from, or null. */
export function sectionFor(note: string | null | undefined): string | null {
  const low = (note ?? '').toLowerCase()
  return SECTIONS.find(([word]) => low.includes(word))?.[1] ?? null
}

const SLUG = /^[a-z0-9-]+$/

/** The guide's file in the person's language if there is one, else the default (English). */
function fileFor(slug: string, lang: Lang): string | undefined {
  return (lang !== 'en' ? FILES[`../../guides/${slug}.${lang}.md`] : undefined) ?? FILES[`../../guides/${slug}.md`]
}

export interface GuideCard { slug: string; title: string; summary: string; order: number }
export interface Guide extends GuideCard { html: string; toc: Heading[] }

export function listGuides(lang: Lang): GuideCard[] {
  const slugs = Object.keys(FILES)
    .map((p) => /\/([a-z0-9-]+)\.md$/.exec(p)?.[1])
    .filter((s): s is string => !!s) // translations (slug.fr.md) are not guides of their own
  return slugs
    .map((slug) => {
      const { meta } = splitFrontMatter(fileFor(slug, lang)!)
      return { slug, title: meta.title || slug, summary: meta.summary, order: meta.order }
    })
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
}

export function loadGuide(slug: string, lang: Lang): Guide | null {
  if (!SLUG.test(slug)) return null
  const text = fileFor(slug, lang)
  if (text === undefined) return null
  const { meta, body } = splitFrontMatter(text)
  const { html, toc } = renderMarkdown(body)
  return { slug, title: meta.title || slug, summary: meta.summary, order: meta.order, html, toc }
}
