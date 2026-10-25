<script lang="ts">
  import { loadGuide } from '../lib/guides/guides'
  import { t, ui } from '../lib/i18n/ui.svelte'
  import { href, route } from '../lib/router.svelte'

  let { slug }: { slug: string } = $props()

  const guide = $derived(loadGuide(slug, ui.lang))
  const at = $derived(route.params.get('at'))

  // Jump to the section named in the address (a link from the wine page or from another guide).
  $effect(() => {
    const target = at
    void guide
    if (!target) return
    const frame = requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(frame)
  })
</script>

<a class="back" href={href('/guides')}>
  <svg width="14" height="14" viewBox="0 0 14 14"><path d="M11 1L4 7L11 13" fill="none" stroke="#1B1815" stroke-width="2" /></svg>{t('Guides')}
</a>
{#if !guide}
  <p class="page-note">{t('Guide not found.')}</p>
{:else}
  <div class="phead"><h1>{guide.title}</h1></div>
  {#if guide.toc.length > 1}
    <nav class="guide-toc" aria-label={t('Sections')}>
      {#each guide.toc as h (h.id)}<a href={href('/guides/' + slug, { at: h.id })}>{h.name}</a>{/each}
    </nav>
  {/if}
  <!-- The guides are our own files, read by a reader that escapes everything (see lib/guides/markdown.ts). -->
  <article class="guide">{@html guide.html}</article>
{/if}
