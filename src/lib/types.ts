/** The data model of Lagar. One record per wine and vintage, plus a log of opened bottles. */

export const WINE_TYPES = ['red', 'white', 'rosé', 'sparkling', 'fortified', 'sweet', 'cider'] as const
export type WineType = (typeof WINE_TYPES)[number]

/** A year, or 'NV' typed by the person for non-vintage wines. It is never guessed. */
export type Vintage = number | 'NV'

export interface Wine {
  id: string
  name: string
  vintage: Vintage
  /** Bottles in the cellar now. */
  bottles: number
  type: WineType | null
  producer: string | null
  country: string | null
  region: string | null
  appellation: string | null
  grapes: string | null
  abv: number | null
  formatCl: number | null
  /** Price paid per bottle, in euros. */
  paid: number | null
  /** Last purchase, as yyyy-mm-dd. Shown to people as dd/mm/yyyy. */
  purchaseDate: string | null
  /** When the wine was added to Lagar (ISO date-time). */
  addedAt: string
  // The fixed "More detail" rows. null = unknown (shown as a dash).
  servingTemperature: string | null
  foodPairing: string | null
  tastingAppearance: string | null
  tastingNose: string | null
  tastingPalate: string | null
  criticsOpinion: string | null
}

export interface OpenedBottle {
  id: string
  wineId: string
  /** yyyy-mm-dd */
  date: string
  qty: number
  occasion: string | null
  note: string | null
}

/** Everything that lives on the phone. */
export interface Snapshot {
  wines: Wine[]
  opened: OpenedBottle[]
  settings: Record<string, string>
}

export const BACKUP_VERSION = 1

/** The backup file: a snapshot plus a little identification. */
export interface Backup extends Snapshot {
  app: 'lagar'
  version: number
  exportedAt: string
}
