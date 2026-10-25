import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Plugin } from 'vite'

export interface BuiltFile {
  path: string // relative to the build folder, with "/" separators
  hash: string
}

/** Every file in the build folder except the service worker itself. */
export function listBuilt(dir: string): BuiltFile[] {
  const out: BuiltFile[] = []
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name)
      if (statSync(full).isDirectory()) walk(full)
      else {
        const path = relative(dir, full).split(sep).join('/')
        if (path === 'sw.js') continue
        out.push({ path, hash: createHash('sha256').update(readFileSync(full)).digest('hex').slice(0, 16) })
      }
    }
  }
  walk(dir)
  return out
}

/** One version for the whole set of files: it changes whenever any file changes. */
export function versionOf(files: BuiltFile[]): string {
  const h = createHash('sha256')
  for (const f of files) h.update(f.path + ':' + f.hash + ';')
  return h.digest('hex').slice(0, 10)
}

/** The service worker: keeps every file of this build on the device and answers from there first. */
export function buildSw(files: BuiltFile[]): string {
  const version = versionOf(files)
  const urls = ['./', ...files.map((f) => './' + f.path)]
  return `// Generated at build time (tools/sw-plugin.ts). Do not edit by hand.
const CACHE = 'lagar-${version}'
const FILES = ${JSON.stringify(urls)}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith('lagar-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true })
      if (hit) return hit
      if (req.mode === 'navigate') {
        const page = await cache.match('./index.html')
        if (page) return page
      }
      return fetch(req)
    }),
  )
})
`
}

export function swPlugin(): Plugin {
  let outDir = 'dist'
  return {
    name: 'lagar-sw',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      writeFileSync(join(outDir, 'sw.js'), buildSw(listBuilt(outDir)))
    },
  }
}
