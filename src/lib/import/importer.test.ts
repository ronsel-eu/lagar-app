import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../storage'
import { makeWine } from '../testing'
import { applyRows, checkRows, MAX_ROWS, message, previewImport, prompt, readImport, templateCsv, TEMPLATE_COLUMNS, wineKey, type Lang } from './importer'
import { parseCsv } from './csv'
import golden from './golden.json'
import existingFixture from './golden-existing.json'
import sample from './sample-cellar.csv?raw'

const bytes = (s: string) => new TextEncoder().encode(s)
const LANGS: Lang[] = ['en', 'es', 'fr']

interface GoldenRow {
  line: number; form: Record<string, string>; added: string | null; warnings: string[]; error: string | null
  action?: string; label?: string; vintage?: number | null; bottles?: number | null; wine_id?: number; was?: number; now?: number
}
interface GoldenCase {
  label: string; rawBase64: string; existing: boolean
  results: Record<Lang, { fatal: string | null; rows: GoldenRow[] }>
}

async function existingStorage() {
  const s = new MemoryStorage()
  for (const e of existingFixture) {
    await s.putWine(makeWine({ id: 'w' + e.id, name: e.name, vintage: e.vintage ?? 'NV', bottles: e.bottles }))
  }
  return s
}

describe('the importer gives the same answers as the original', () => {
  for (const c of golden as unknown as GoldenCase[]) {
    for (const lang of LANGS) {
      it(`${c.label} (${lang})`, async () => {
        const raw = Uint8Array.from(atob(c.rawBase64), (ch) => ch.charCodeAt(0))
        const want = c.results[lang]
        const { rows, fatal } = c.existing ? await previewImport(await existingStorage(), raw) : readImport(raw)
        expect(fatal ? message(fatal, lang) : null).toBe(want.fatal)
        expect(rows).toHaveLength(want.rows.length)
        rows.forEach((row, i) => {
          const w = want.rows[i]
          expect(row.line).toBe(w.line)
          expect(row.form).toEqual(w.form)
          expect(row.added).toBe(w.added)
          expect(row.warnings.map((x) => message(x, lang))).toEqual(w.warnings)
          expect(row.error ? message(row.error, lang) : null).toBe(w.error)
          if (c.existing) {
            expect(row.action).toBe(w.action)
            if ('label' in w) {
              expect(row.label).toBe(w.label)
              expect(row.vintage).toBe(w.vintage)
              expect(row.bottles).toBe(w.bottles)
            }
            expect(row.wineId).toBe(w.wine_id === undefined ? undefined : 'w' + w.wine_id)
            expect(row.was).toBe(w.was)
            expect(row.now).toBe(w.now)
          }
        })
      })
    }
  }
})

describe('the template and the prompts', () => {
  it('the template is the header row', () => {
    expect(templateCsv()).toBe('name,vintage,bottles,type,producer,country,region,appellation,grapes,paid,purchase_date\n')
    expect(TEMPLATE_COLUMNS).toHaveLength(11)
  })

  it('every prompt asks for the template columns and says never to invent data', () => {
    for (const lang of LANGS) {
      expect(prompt(lang)).toContain(templateCsv().trim())
    }
    expect(prompt('en')).toContain('NEVER invent')
  })

  it('the template read back as a file has no wines', () => {
    expect(readImport(bytes(templateCsv())).fatal?.key).toBe('The file has column names but no wines.')
  })
})

describe('limits and odd files', () => {
  it('rejects a file over 2 MB', () => {
    expect(readImport(new Uint8Array(2_000_001)).fatal?.key).toBe('The file is too large (2 MB at most).')
  })

  it('rejects more than 5000 rows, accepts 5000', () => {
    const make = (n: number) => 'name,vintage,bottles\n' + Array.from({ length: n }, (_, i) => `Wine ${i},2015,1`).join('\n') + '\n'
    expect(readImport(bytes(make(MAX_ROWS))).rows).toHaveLength(MAX_ROWS)
    expect(readImport(bytes(make(MAX_ROWS + 1))).fatal?.key).toBe('Too many rows (at most {n}).')
  })

  it('accepts a file whose lines end with a lone carriage return (the original crashed on these)', () => {
    const { rows, fatal } = readImport(bytes('name,vintage,bottles\rA,2015,1\rB,2016,2\r'))
    expect(fatal).toBeNull()
    expect(rows.map((r) => r.form.name)).toEqual(['A', 'B'])
  })

  it('does not take a built-in word for a wine type', () => {
    const { rows } = readImport(bytes('name,vintage,bottles,type\nA,2015,1,constructor\n'))
    expect(rows[0].warnings[0].key).toBe("Type '{x}' not recognised; left empty.")
    expect(rows[0].form.colour).toBe('')
  })
})

describe('the csv reader', () => {
  it('reads quotes, doubled quotes and line breaks inside a cell', () => {
    expect(parseCsv('a,"b,c","d ""e"" f","g\nh"\n', ',')).toEqual([['a', 'b,c', 'd "e" f', 'g\nh']])
  })
  it('keeps blank lines as empty records and ignores the final line end', () => {
    expect(parseCsv('a\n\nb\n', ',')).toEqual([['a'], [], ['b']])
    expect(parseCsv('a,b', ',')).toEqual([['a', 'b']])
    expect(parseCsv('', ',')).toEqual([])
  })
  it('treats a quote inside an unquoted cell as a character', () => {
    expect(parseCsv('5" tall,x\n', ',')).toEqual([['5" tall', 'x']])
  })
})

describe('keys and saving', () => {
  it('a wine is its name without a trailing vintage, plus the vintage', () => {
    expect(wineKey('Viña Tondonia Reserva 2012', 2012)).toBe(wineKey('Vina Tondonia, Reserva', 2012))
    expect(wineKey('Tondonia', 2012)).not.toBe(wineKey('Tondonia', 2013))
    expect(wineKey('Tondonia', null)).not.toBe(wineKey('Tondonia', 2012))
  })

  it('imports the sample cellar: all rows new, nothing lost', async () => {
    const s = new MemoryStorage()
    const { rows, fatal } = await previewImport(s, bytes(sample))
    expect(fatal).toBeNull()
    expect(rows.every((r) => r.action === 'new')).toBe(true)
    const result = await applyRows(s, rows, new Date('2026-10-25T10:00:00Z'))
    expect(result).toEqual({ added: rows.length, updated: 0 })
    const wines = await s.listWines()
    expect(wines).toHaveLength(rows.length)
    expect(wines.reduce((n, w) => n + w.bottles, 0)).toBe(rows.reduce((n, r) => n + r.bottles!, 0))
    expect(wines.every((w) => w.addedAt === '2026-10-25T10:00:00.000Z' && w.ownWindow === null)).toBe(true)
  })

  it('importing the same file again ADDS the bottles: 1 in the cellar + 4 in the file = 5', async () => {
    const s = new MemoryStorage()
    await s.putWine(makeWine({ id: 'a', name: 'Tondonia', vintage: 2012, bottles: 1 }))
    const file = bytes('name,vintage,bottles\nTondonia,2012,4\n')
    const { rows } = await previewImport(s, file)
    expect(rows[0]).toMatchObject({ action: 'update', was: 1, now: 5 })
    expect(await applyRows(s, rows)).toEqual({ added: 0, updated: 1 })
    expect((await s.getWine('a'))?.bottles).toBe(5)
    // and a second time it adds again, as the original does
    const again = await previewImport(s, file)
    await applyRows(s, again.rows)
    expect((await s.getWine('a'))?.bottles).toBe(9)
  })

  it('keeps a non-vintage wine as NV, never as a guessed year, and never imports a blank vintage', async () => {
    const s = new MemoryStorage()
    const { rows } = await previewImport(s, bytes('name,vintage,bottles\nTio Pepe,NV,2\nMystery,,1\n'))
    expect(rows[1].error?.key).toBe('The vintage is required: write a year, or NV for a non-vintage wine.')
    await applyRows(s, rows)
    const wines = await s.listWines()
    expect(wines).toHaveLength(1)
    expect(wines[0].vintage).toBe('NV')
  })

  it('does not save rows with errors, duplicates or nothing to add', async () => {
    const s = new MemoryStorage()
    await s.putWine(makeWine({ id: 'a', name: 'Known', vintage: 2010, bottles: 2 }))
    const { rows } = await previewImport(s, bytes('name,vintage,bottles\nKnown,2010,0\nNew,2015,1\nNew,2015,1\n,2015,1\n'))
    expect(rows.map((r) => r.action)).toEqual(['same', 'new', 'error', 'error'])
    expect(await applyRows(s, rows)).toEqual({ added: 1, updated: 0 })
    expect((await s.getWine('a'))?.bottles).toBe(2)
  })

  it('checkRows can be run again after the cellar changes', async () => {
    const s = new MemoryStorage()
    const { rows } = readImport(bytes('name,vintage,bottles\nA,2015,1\n'))
    expect(checkRows(rows, [])[0].action).toBe('new')
    expect(checkRows(rows, [makeWine({ name: 'A', vintage: 2015, bottles: 3 })])[0]).toMatchObject({ action: 'update', now: 4 })
    void s
  })
})

describe('optional drinking window columns', () => {
  const csv = (rows: string[]) => bytes(['name,vintage,bottles,drink_from,drink_to', ...rows].join('\n'))

  it('reads a valid window and saves it as the wine\'s own window', async () => {
    const s = new MemoryStorage()
    const { rows } = await previewImport(s, csv(['A,2015,1,2024,2030']))
    expect(rows[0].window).toEqual({ fromYear: 2024, toYear: 2030 })
    await applyRows(s, rows)
    expect((await s.listWines())[0].ownWindow).toEqual({ fromYear: 2024, toYear: 2030 })
  })

  it('ignores an empty, reversed or non-year window', () => {
    const { rows } = readImport(csv(['A,2015,1,,', 'B,2015,1,2030,2024', 'C,2015,1,soon,2030', 'D,2015,1,2024,']))
    expect(rows.map((r) => r.window)).toEqual([null, null, null, { fromYear: 2024, toYear: null }])
  })

  it('accepts a window with only one end', () => {
    const { rows } = readImport(csv(['A,2015,1,,2033']))
    expect(rows[0].window).toEqual({ fromYear: null, toYear: 2033 })
  })

  it('works without the columns', () => {
    expect(readImport(bytes('name,vintage,bottles\nA,2015,1')).rows[0].window).toBeNull()
  })
})

describe('optional critic points column', () => {
  const csv = (rows: string[]) => bytes(['name,vintage,bottles,points', ...rows].join('\n'))

  it('reads valid points and saves them on a new wine', async () => {
    const s = new MemoryStorage()
    const { rows } = await previewImport(s, csv(['A,2015,1,93', 'B,2015,1,"91,5"']))
    expect(rows.map((r) => r.points)).toEqual([93, 91.5])
    await applyRows(s, rows)
    expect((await s.listWines()).map((w) => w.criticPoints).sort()).toEqual([91.5, 93])
  })
  it('ignores empty, out of range or non-numeric points', () => {
    const { rows } = readImport(csv(['A,2015,1,', 'B,2015,1,17/20', 'C,2015,1,150', 'D,2015,1,great', 'E,2015,1,12']))
    expect(rows.map((r) => r.points)).toEqual([null, null, null, null, null])
  })
  it('works without the column', () => {
    expect(readImport(bytes('name,vintage,bottles\nA,2015,1')).rows[0].points).toBeNull()
  })
})

describe('optional detail columns', () => {
  const head = 'name,vintage,bottles,abv,format_cl,serving_temperature,food_pairing,appearance,nose,palate,link,points,critic'
  it('reads them and saves them on a new wine', async () => {
    const s = new MemoryStorage()
    const { rows } = await previewImport(s, bytes(`${head}\nA,2015,1,"13,5%",150,16-18 °C,Lamb,Deep ruby,Plum,Round,https://www.bodeboca.com/vino/x,95,Parker`))
    expect(rows[0].details).toMatchObject({ abv: 13.5, formatCl: 150, servingTemperature: '16-18 °C', foodPairing: 'Lamb' })
    await applyRows(s, rows)
    const [w] = await s.listWines()
    expect(w).toMatchObject({ abv: 13.5, formatCl: 150, tastingAppearance: 'Deep ruby', tastingNose: 'Plum', tastingPalate: 'Round', link: 'https://www.bodeboca.com/vino/x', criticPoints: 95, criticName: 'Parker' })
  })
  it('gives null for empty or unreadable cells and keeps 75 cl by default', async () => {
    const s = new MemoryStorage()
    const { rows } = await previewImport(s, bytes(`${head}\nA,2015,1,lots,,,,,,,javascript:alert(1),,`))
    await applyRows(s, rows)
    const [w] = await s.listWines()
    expect(w).toMatchObject({ abv: null, formatCl: 75, servingTemperature: null, tastingNose: null, link: null })
  })
  it('works without the columns', () => {
    expect(readImport(bytes('name,vintage,bottles\nA,2015,1')).rows[0].details).toBeUndefined()
  })
})
