/**
 * A small markdown reader for the guides: front matter, ## headings with {#id}, paragraphs, - and 1. lists, tables,
 * **bold**, *italic* and links. Everything is escaped first, so a guide can never put markup or script into the page.
 * Links to /guides/slug#section become links inside the app; only http(s) links leave it.
 */

export interface GuideMeta { title: string; summary: string; order: number }
export interface Heading { id: string; name: string }

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 'Rías Baixas' -> 'rias-baixas' */
export function slugify(name: string): string {
  return name.normalize('NFKD').replace(/[^\x00-\x7f]/g, '').toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-')
}

/** The settings at the top of a guide file (between --- lines) and the text after them. */
export function splitFrontMatter(text: string): { meta: GuideMeta; body: string } {
  const meta: GuideMeta = { title: '', summary: '', order: 99 }
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text.replace(/\r\n?/g, '\n'))
  if (!m) return { meta, body: text }
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const key = line.slice(0, i).trim()
    const value = line.slice(i + 1).trim()
    if (key === 'title') meta.title = value
    else if (key === 'summary') meta.summary = value
    else if (key === 'order' && /^\d+$/.test(value)) meta.order = Number(value)
  }
  return { meta, body: m[2] }
}

/** The address inside the app for a guide link: /guides/slug#section -> #/guides/slug?at=section */
function internalHref(url: string): string | null {
  const m = /^\/guides\/([a-z0-9-]+)(?:#([\w-]+))?$/.exec(url)
  return m ? `#/guides/${m[1]}${m[2] ? `?at=${m[2]}` : ''}` : null
}

function inline(text: string): string {
  let out = escapeHtml(text)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_all, label: string, url: string) => {
    const plain = url.replace(/&amp;/g, '&')
    const inside = internalHref(plain)
    if (inside) return `<a href="${inside}">${label}</a>`
    if (/^https?:\/\//.test(plain)) return `<a href="${url}" target="_blank" rel="noopener">${label}</a>`
    return label
  })
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?![*\w])/g, '$1<em>$2</em>')
  return out
}

const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
const isTableRule = (line: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim())

/** The page body and the list of ## sections (for the jump links at the top). */
export function renderMarkdown(body: string): { html: string; toc: Heading[] } {
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  const html: string[] = []
  const toc: Heading[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    const h = /^(#{2,3})\s+(.*?)\s*(?:\{#([\w-]+)\})?\s*$/.exec(line)
    if (h) {
      const level = h[1].length
      const name = h[2].trim()
      const id = h[3] ?? slugify(name)
      if (level === 2) toc.push({ id, name })
      html.push(`<h${level} id="${escapeHtml(id)}">${inline(name)}</h${level}>`)
      i++
      continue
    }

    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableRule(lines[i + 1])) {
      const head = cells(line)
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]))
      html.push(
        '<table><thead><tr>' + head.map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
          rows.map((r) => '<tr>' + head.map((_, k) => `<td>${inline(r[k] ?? '')}</td>`).join('') + '</tr>').join('') + '</tbody></table>',
      )
      continue
    }

    const list = /^(-|\d+\.)\s+/.exec(line)
    if (list) {
      const ordered = list[1] !== '-'
      const items: string[] = []
      while (i < lines.length) {
        const m = /^(-|\d+\.)\s+(.*)$/.exec(lines[i])
        if (m && (m[1] !== '-') === ordered) { items.push(m[2]); i++ }
        else if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ' ' + lines[i].trim(); i++ }
        else break
      }
      const tag = ordered ? 'ol' : 'ul'
      html.push(`<${tag}>` + items.map((t) => `<li>${inline(t)}</li>`).join('') + `</${tag}>`)
      continue
    }

    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^#{2,3}\s/.test(lines[i]) && !/^(-|\d+\.)\s+/.test(lines[i]) && !lines[i].trim().startsWith('|')) para.push(lines[i++].trim())
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`)
    else i++
  }
  return { html: html.join('\n'), toc }
}
