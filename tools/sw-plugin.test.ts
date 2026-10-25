import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildSw, listBuilt, versionOf } from './sw-plugin'

const files = [
  { path: 'index.html', hash: 'aaa' },
  { path: 'assets/app-1.js', hash: 'bbb' },
]

describe('service worker', () => {
  it('lists every file to keep, with the start page', () => {
    const sw = buildSw(files)
    expect(sw).toContain('"./"')
    expect(sw).toContain('"./index.html"')
    expect(sw).toContain('"./assets/app-1.js"')
  })
  it('changes its version when any file changes, and only then', () => {
    expect(versionOf(files)).toBe(versionOf([...files]))
    expect(versionOf(files)).not.toBe(versionOf([files[0], { ...files[1], hash: 'ccc' }]))
    expect(buildSw(files)).not.toBe(buildSw([files[0], { ...files[1], hash: 'ccc' }]))
  })
  it('fetches every file past the browser cache, so a stale index.html can never be kept', () => {
    const sw = buildSw(files)
    expect(sw).toContain("cache: 'reload'")
    expect(sw).not.toContain('addAll')
  })
  it('only deletes its own old caches', () => {
    expect(buildSw(files)).toContain("n.startsWith('lagar-')")
  })
  it('reads a build folder, skipping the worker itself', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lagar-'))
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'index.html'), 'x')
    writeFileSync(join(dir, 'sw.js'), 'old')
    writeFileSync(join(dir, 'assets', 'a.js'), 'y')
    expect(listBuilt(dir).map((f) => f.path)).toEqual(['assets/a.js', 'index.html'])
  })
})
