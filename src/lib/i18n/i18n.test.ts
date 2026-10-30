import { describe, expect, it } from 'vitest'
import { IT, IT_PLACES } from './it'
import { EXTRA } from './extra'
import { PLACES, STRINGS } from './strings'
import { browserLang, translate, translatePlace, translatePlural } from './index'

describe('translations', () => {
  it('shows English as it is, and an unknown text in English', () => {
    expect(translate('en', 'Wines')).toBe('Wines')
    expect(translate('es', 'A text nobody translated')).toBe('A text nobody translated')
  })
  it('translates and fills in values', () => {
    expect(translate('es', 'Wines')).toBe('Vinos')
    expect(translate('fr', 'Import {n} new', { n: 3 })).toBe('Importer 3 nouveaux')
  })
  it('chooses singular or plural', () => {
    expect(translatePlural('es', 1, 'bottle', 'bottles')).toBe('botella')
    expect(translatePlural('es', 2, 'bottle', 'bottles')).toBe('botellas')
    expect(translatePlural('en', 1, 'opened|one', 'opened')).toBe('opened')
    expect(translatePlural('fr', 1, 'opened|one', 'opened')).toBe('ouverte')
    expect(translatePlural('fr', 2, 'opened|one', 'opened')).toBe('ouvertes')
  })
  it('translates countries and leaves unknown places as stored', () => {
    expect(translatePlace('es', 'Spain')).toBe('España')
    expect(translatePlace('fr', 'Germany')).toBe('Allemagne')
    expect(translatePlace('es', 'Somewhere else')).toBe('Somewhere else')
    expect(translatePlace('es', null)).toBe('')
  })
  it('does not trip over names that exist on every object', () => {
    expect(translate('es', 'constructor')).toBe('constructor')
    expect(translatePlace('es', 'constructor')).toBe('constructor')
  })
  it('starts in the browser language when it is one of ours', () => {
    expect(browserLang(['fr-FR', 'en'])).toBe('fr')
    expect(browserLang(['de-DE', 'es-ES'])).toBe('es')
    expect(browserLang(['de-DE'])).toBe('en')
    expect(browserLang([])).toBe('en')
  })
  // Every text the Home and Wines screens use must have a translation, in both languages.
  it('has all the texts of Home, Wines and Search in Spanish and French', () => {
    const used = [
      'Home', 'Wines', 'Guides', 'Settings', 'Main', 'Lagar, home', 'Add a wine', 'Bottles', 'Drink now', 'Cellar', 'Search',
      'Search your cellar', 'Suggestions', 'Red', 'White', 'Cellar cost', 'Welcome to Lagar', 'Import your cellar',
      'Just one bottle to start with? Add it by hand.', 'Not sure yet? See how it works with made-up wines.', 'In my cellar', 'Opened', 'Both', 'Order', 'Newest purchase', 'Oldest purchase',
      'Price: high to low', 'Price: low to high', 'All countries', 'All regions', 'All appellations', 'All types', 'All grapes',
      'All vintages', 'Drinking', 'Any drinking status', 'Clear filters', 'No wines match.', 'Drink soon', 'Can wait', 'Keep',
      'Evolves', 'now', 'soon', 'young', 'wine', 'wines', 'bottle', 'opened|one', 'opened', 'Rosé', 'Sparkling', 'Fortified',
      'Sweet', 'Cider', 'Name, producer, appellation, grape', 'Not here. Maybe you already drank it?', 'See opened wines',
      'No wines yet. Start with Settings, then Import your cellar.', 'Language', 'Close',
    ]
    const missing = used.filter((k) => translate('es', k) === k.split('|')[0] && !['Home', 'Rosé', 'Keep', 'Evolves'].includes(k))
    expect(missing).toEqual([])
    const missingFr = used.filter((k) => translate('fr', k) === k.split('|')[0] && !['Guides', 'Evolves', 'Rosé', 'Sweet', 'Suggestions'].includes(k))
    expect(missingFr).toEqual([])
  })

  describe('Italian', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort()
    it('translates and fills in values', () => {
      expect(translate('it', 'Wines')).toBe('Vini')
      expect(translate('it', 'Import {n} new', { n: 3 })).toBe('Importa 3 nuovi')
      expect(translate('it', 'A text nobody translated')).toBe('A text nobody translated')
      expect(translate('it', 'constructor')).toBe('constructor')
    })
    it('chooses singular or plural', () => {
      expect(translatePlural('it', 1, 'bottle', 'bottles')).toBe('bottiglia')
      expect(translatePlural('it', 2, 'bottle', 'bottles')).toBe('bottiglie')
      expect(translatePlural('it', 1, 'opened|one', 'opened')).toBe('aperta')
      expect(translatePlural('it', 2, 'opened|one', 'opened')).toBe('aperte')
    })
    it('has every text the other languages have, with the same placeholders', () => {
      const keys = [...Object.keys(STRINGS), ...Object.keys(EXTRA)]
      expect(keys.filter((k) => !Object.hasOwn(IT, k))).toEqual([])
      expect(Object.keys(IT).filter((k) => !keys.includes(k))).toEqual([])
      for (const k of keys) expect(placeholders(IT[k]), k).toEqual(placeholders(k.split('|')[0]))
    })
    it('translates every country and region that Spanish and French do', () => {
      expect(Object.keys(PLACES).filter((k) => !Object.hasOwn(IT_PLACES, k))).toEqual([])
      expect(translatePlace('it', 'Spain')).toBe('Spagna')
      expect(translatePlace('it', 'Cataluña')).toBe('Catalogna')
      expect(translatePlace('it', 'Somewhere else')).toBe('Somewhere else')
      expect(translatePlace('it', null)).toBe('')
    })
    it('starts in the browser language when it is Italian', () => {
      expect(browserLang(['it-IT', 'en'])).toBe('it')
    })
  })
})
