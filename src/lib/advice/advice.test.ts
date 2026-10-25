import { describe, expect, it } from 'vitest'
import { adviceFor, norm, statusFromWindow } from './engine'
import { makeWine } from '../testing'
import golden from './golden.json'

interface Case {
  label: string
  year: number
  input: {
    name: string; type: string | null; vintage: number | 'NV'; producer: string | null; country: string | null
    region: string | null; appellation: string | null; grapes: string | null; purchaseDate: string | null
  }
  expected: { status: string; fromYear: number | null; toYear: number | null; keeps: string; note: string }
}

describe('the advice engine gives the same answers as the original', () => {
  for (const c of golden as Case[]) {
    it(`${c.label} (${c.year})`, () => {
      const i = c.input
      const wine = makeWine({
        name: i.name, type: i.type as never, vintage: i.vintage, producer: i.producer, country: i.country,
        region: i.region, appellation: i.appellation, grapes: i.grapes, purchaseDate: i.purchaseDate,
      })
      const a = adviceFor(wine, c.year)
      expect({ status: a.status, fromYear: a.fromYear, toYear: a.toYear, keeps: a.keeps, note: a.note }).toEqual(c.expected)
      expect(a.source).toBe('rule')
    })
  }
})

describe('helpers', () => {
  it('norm drops accents and punctuation', () => {
    expect(norm('Viña Tondonia, Reserva')).toBe('vina tondonia  reserva')
    expect(norm(null)).toBe('')
  })

  it('status follows the window', () => {
    expect(statusFromWindow(2010, 2025, 2026)).toBe('drink_now')
    expect(statusFromWindow(2010, 2028, 2026)).toBe('drink_soon')
    expect(statusFromWindow(2010, 2029, 2026)).toBe('can_wait')
    expect(statusFromWindow(2030, 2040, 2026)).toBe('keep')
    expect(statusFromWindow(null, null, 2026)).toBe('can_wait')
  })
})

describe('own window', () => {
  const base = makeWine({ name: 'Rioja Crianza', appellation: 'Rioja', vintage: 2019 })

  it('beats the style rules', () => {
    const rule = adviceFor(base, 2026)
    const own = adviceFor({ ...base, ownWindow: { fromYear: 2030, toYear: 2040 } }, 2026)
    expect(rule.source).toBe('rule')
    expect(own).toMatchObject({ source: 'own', status: 'keep', fromYear: 2030, toYear: 2040 })
  })

  it('can leave one end open', () => {
    expect(adviceFor({ ...base, ownWindow: { fromYear: null, toYear: 2025 } }, 2026).status).toBe('drink_now')
    expect(adviceFor({ ...base, ownWindow: { fromYear: 2020, toYear: null } }, 2026).status).toBe('can_wait')
  })

  it('is not changed by the young-vintage rule: your own choice stands', () => {
    const young = makeWine({ name: 'Rosado', type: 'rosé', vintage: 2025, ownWindow: { fromYear: 2025, toYear: 2025 } })
    expect(adviceFor(young, 2026).status).toBe('drink_now')
  })
})
