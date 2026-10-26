import { describe, expect, it } from 'vitest'
import { dmy, eur, num } from './format'

describe('format', () => {
  it('writes thousands with a period', () => {
    expect(num(0)).toBe('0')
    expect(num(999)).toBe('999')
    expect(num(1000)).toBe('1.000')
    expect(num(1248)).toBe('1.248')
    expect(num(1234567)).toBe('1.234.567')
  })
  it('writes money like the original app', () => {
    expect(eur(9846)).toBe('9.846 €')
    expect(eur(42, 2)).toBe('42,00 €')
    expect(eur(1234.5, 2)).toBe('1.234,50 €')
  })
  it('writes dates as dd/mm/yyyy', () => {
    expect(dmy('2026-10-17')).toBe('17/10/2026')
    expect(dmy('2026-10-17T09:00:00Z')).toBe('17/10/2026')
    expect(dmy(null)).toBe('')
    expect(dmy('soon')).toBe('soon')
  })
})

describe('shopName', () => {
  it('shows the host without www', async () => {
    const { shopName } = await import('./format')
    expect(shopName('https://www.bodeboca.com/vino/x')).toBe('bodeboca.com')
    expect(shopName('not a url')).toBe('not a url')
  })
})
