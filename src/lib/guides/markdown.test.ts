import { describe, expect, it } from 'vitest'
import { renderMarkdown, slugify, splitFrontMatter } from './markdown'

describe('markdown for guides', () => {
  it('keeps a temperature range on one line', () => {
    const { html } = renderMarkdown('A cellar at 12-14 °C is right. Take it out 15-20 minutes before. Serve at 12–14º.')
    expect(html).toContain('<span class="nb">12-14 °C</span>')
    expect(html).toContain('<span class="nb">15-20</span>')
    expect(html).toContain('<span class="nb">12–14º</span>')
  })

  it('reads the front matter', () => {
    const { meta, body } = splitFrontMatter('---\ntitle: Serving: cold\nsummary: How cold\norder: 4\n---\n\nHello')
    expect(meta).toEqual({ title: 'Serving: cold', summary: 'How cold', order: 4 })
    expect(body.trim()).toBe('Hello')
    expect(splitFrontMatter('No settings here').meta.order).toBe(99)
  })

  it('makes headings with an id, from {#id} or from the name', () => {
    const { html, toc } = renderMarkdown('## Xérès {#sherry}\n\n## Rías Baixas\n\n### Small')
    expect(toc).toEqual([{ id: 'sherry', name: 'Xérès' }, { id: 'rias-baixas', name: 'Rías Baixas' }])
    expect(html).toContain('<h2 id="sherry">Xérès</h2>')
    expect(html).toContain('<h2 id="rias-baixas">Rías Baixas</h2>')
    expect(html).toContain('<h3 id="small">Small</h3>')
    expect(slugify('Utiel-Requena')).toBe('utiel-requena')
    expect(slugify('Ribera del Duero')).toBe('ribera-del-duero')
  })

  it('makes tables, filling short rows', () => {
    const { html } = renderMarkdown('| Type | Window |\n|---|---|\n| Joven | 1-3 |\n| Crianza |\n')
    expect(html).toBe('<table><thead><tr><th>Type</th><th>Window</th></tr></thead><tbody><tr><td>Joven</td><td><span class="nb">1-3</span></td></tr><tr><td>Crianza</td><td></td></tr></tbody></table>')
  })

  it('makes bullet and numbered lists, with wrapped lines', () => {
    expect(renderMarkdown('- one\n- **two**\n  more').html).toBe('<ul><li>one</li><li><strong>two</strong> more</li></ul>')
    expect(renderMarkdown('1. a\n2. b').html).toBe('<ol><li>a</li><li>b</li></ol>')
  })

  it('joins the lines of a paragraph and separates paragraphs', () => {
    expect(renderMarkdown('one\ntwo\n\nthree').html).toBe('<p>one two</p>\n<p>three</p>')
  })

  it('writes bold and italic, but not stray stars', () => {
    expect(renderMarkdown('a **b** and *c* d').html).toBe('<p>a <strong>b</strong> and <em>c</em> d</p>')
    expect(renderMarkdown('2 * 3 * 4').html).toBe('<p>2 * 3 * 4</p>')
  })

  it('turns guide links into links inside the app', () => {
    expect(renderMarkdown('See [Riesling](/guides/consumption-windows#riesling) and [all](/guides/decanting).').html).toBe(
      '<p>See <a href="#/guides/consumption-windows?at=riesling">Riesling</a> and <a href="#/guides/decanting">all</a>.</p>',
    )
  })

  it('opens outside links safely and drops anything else', () => {
    expect(renderMarkdown('[x](https://example.com/a?b=1&c=2)').html).toContain('<a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener">x</a>')
    expect(renderMarkdown('[x](javascript:alert(1))').html).not.toContain('href')
    expect(renderMarkdown('[x](/somewhere/else)').html).toBe('<p>x</p>')
  })

  it('never lets markup through', () => {
    const { html } = renderMarkdown('<script>alert(1)</script> & "q"\n\n| <b>x</b> |\n|---|\n| <img src=x onerror=1> |')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<b>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp; &quot;q&quot;')
  })
})
