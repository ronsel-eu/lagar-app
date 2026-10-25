import { describe, expect, it } from 'vitest'
import { BANDS, pickBand } from './band'

describe('label band', () => {
  it('never picks the colour it had last time', () => {
    for (const last of BANDS) for (const r of [0, 0.3, 0.6, 0.99]) expect(pickBand(last, () => r)).not.toBe(last)
  })
  it('picks any colour when there is no last one', () => {
    expect(new Set([0, 0.25, 0.5, 0.75, 0.99].map((r) => pickBand(null, () => r))).size).toBe(BANDS.length)
  })
})
