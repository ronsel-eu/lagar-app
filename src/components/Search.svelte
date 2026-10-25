<script lang="ts">
  import { onMount } from 'svelte'
  import { searchCellar, type Row } from '../lib/browse'
  import { t, tn } from '../lib/i18n/ui.svelte'
  import { go, href, route } from '../lib/router.svelte'
  import type { Wine } from '../lib/types'
  import WineList from './WineList.svelte'

  let { rows, wines }: { rows: Row[]; wines: Wine[] } = $props()

  const q = $derived((route.params.get('q') ?? '').trim())
  const found = $derived(searchCellar(rows, wines, q))
  let text = $state('')
  let input: HTMLInputElement | undefined = $state()

  onMount(() => {
    text = q
    input?.focus()
  })
  function submit(event: SubmitEvent) {
    event.preventDefault()
    go('/search', { q: text.trim() }, true)
  }
</script>

<a class="back" href={href('/')}>
  <svg width="14" height="14" viewBox="0 0 14 14"><path d="M11 1L4 7L11 13" fill="none" stroke="#1B1815" stroke-width="2" /></svg>{t('Home')}
</a>
<div class="phead">
  <h1>{t('Search')}</h1>
  {#if q}<span class="meta">{found.length} {tn(found.length, 'wine', 'wines')}</span>{/if}
</div>
<form class="search" role="search" onsubmit={submit}>
  <button type="submit" aria-label={t('Search')}>
    <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="8" cy="8" r="6" fill="none" stroke="#1B1815" stroke-width="2" /><path d="M12.5 12.5L18 18" fill="none" stroke="#1B1815" stroke-width="2" /></svg>
  </button>
  <input type="search" bind:value={text} bind:this={input} placeholder={t('Name, producer, appellation, grape')} aria-label={t('Search your cellar')} />
</form>
<div style="height: 14px"></div>
{#if q}
  {#if found.length}
    <WineList rows={found} />
  {:else}
    <section class="notfound">
      <p class="big">{t('Not here. Maybe you already drank it?')}</p>
      <p>{t('Search only looks at the wines still in your cellar. Check the spelling, or look in your opened wines.')}</p>
      <p class="actions">
        <a class="btn" href={href('/wines', { state: 'opened' })}>{t('See opened wines')}</a>
        <a class="btn secondary" href={href('/wine/new')}>{t('Add a wine')}</a>
      </p>
    </section>
  {/if}
{/if}
