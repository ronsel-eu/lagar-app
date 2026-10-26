import type { Wine } from './types'

/** A complete wine for tests; pass only what the test cares about. */
export function makeWine(overrides: Partial<Wine> = {}): Wine {
  return {
    id: 'w1', name: 'Bodegas Altamira Gran Reserva', vintage: 2010, bottles: 3, type: 'red',
    producer: 'Bodegas Altamira', country: 'Spain', region: 'Rioja', appellation: 'Rioja', grapes: 'Tempranillo',
    abv: null, formatCl: 75, paid: 48.5, criticPoints: null, criticName: null, purchaseDate: '2022-03-14', addedAt: '2026-10-25T09:00:00.000Z',
    ownWindow: null, servingTemperature: null, foodPairing: null, tastingAppearance: null, tastingNose: null, tastingPalate: null,
    criticsOpinion: null, link: null,
    ...overrides,
  }
}
