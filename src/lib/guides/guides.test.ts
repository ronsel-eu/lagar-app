import { describe, expect, it } from 'vitest'
import type { Lang } from '../i18n'
import { listGuides, loadGuide, sectionFor } from './guides'

const LANGS: Lang[] = ['en', 'es', 'fr', 'it']

describe('guides', () => {
  it('lists the four guides in order, in every language', () => {
    for (const lang of LANGS) {
      const list = listGuides(lang)
      expect(list.map((g) => g.slug)).toEqual(['consumption-windows', 'riesling-styles', 'decanting', 'serving-temperatures'])
      expect(list.every((g) => g.title && g.summary)).toBe(true)
    }
    expect(listGuides('es')[0].title).toBe('Ventanas de consumo del vino')
    expect(listGuides('fr')[2].title).not.toBe(listGuides('en')[2].title)
    expect(listGuides('it')[0].title).toBe('Finestre di consumo dei vini')
  })

  it('loads every guide in every language', () => {
    for (const lang of LANGS) {
      for (const g of listGuides(lang)) {
        const guide = loadGuide(g.slug, lang)!
        expect(guide.html.length).toBeGreaterThan(100)
        expect(guide.html).not.toContain('<script')
      }
    }
  })

  it('the consumption windows guide has a jump link for every region', () => {
    for (const lang of LANGS) expect(loadGuide('consumption-windows', lang)!.toc.length).toBeGreaterThanOrEqual(15)
  })

  it('does not load a guide that is not there, or a name that is not a guide name', () => {
    expect(loadGuide('nope', 'en')).toBeNull()
    expect(loadGuide('../secret', 'en')).toBeNull()
    expect(loadGuide('Decanting', 'en')).toBeNull()
  })

  it('says nothing about critics or shops any more', () => {
    for (const lang of LANGS) for (const g of listGuides(lang)) {
      const text = loadGuide(g.slug, lang)!.html.toLowerCase()
      expect(text).not.toMatch(/ critic| crítico| critique|shop page|página de tienda|page de boutique/)
    }
  })

  it('every link inside a guide goes to a guide and section that exist', () => {
    for (const lang of LANGS) {
      for (const g of listGuides(lang)) {
        const html = loadGuide(g.slug, lang)!.html
        for (const m of html.matchAll(/href="#\/guides\/([a-z0-9-]+)(?:\?at=([\w-]+))?"/g)) {
          const target = loadGuide(m[1], lang)
          expect(target, `${lang}/${g.slug} links to ${m[1]}`).not.toBeNull()
          if (m[2]) expect(target!.html, `${lang}/${g.slug} -> ${m[1]}#${m[2]}`).toContain(`id="${m[2]}"`)
        }
      }
    }
  })

  it('the wine page can jump to a section that exists in every language', () => {
    const notes = ['Rioja Reserva', 'Riesling Kabinett', 'Sherry (Fino)', 'Ribera del Duero Crianza', 'Priorat', 'Champagne', 'Barolo', 'Port', 'Bordeaux', 'Cava', 'Rías Baixas'.replace('í', 'i')]
    for (const lang of LANGS) {
      const html = loadGuide('consumption-windows', lang)!.html
      for (const n of notes) {
        const section = sectionFor(n)
        expect(section, n).not.toBeNull()
        expect(html, `${lang}: ${section}`).toContain(`id="${section}"`)
      }
    }
    expect(sectionFor('Nothing known')).toBeNull()
    expect(sectionFor(null)).toBeNull()
  })
})
