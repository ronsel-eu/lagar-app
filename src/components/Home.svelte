<script lang="ts">
  import { homePicks, homeStats, type Row } from '../lib/browse'
  import { eur, num } from '../lib/format'
  import { t } from '../lib/i18n/ui.svelte'
  import { go, href } from '../lib/router.svelte'
  import WineList from './WineList.svelte'

  let { rows, year }: { rows: Row[]; year: number } = $props()

  const stats = $derived(homeStats(rows))
  // New picks each time Home is opened (and when the cellar changes).
  const picks = $derived(homePicks(rows, year))
  const big = $derived(stats.bottles >= 1000 || stats.wines >= 1000 || stats.drinkNow >= 1000)

  let q = $state('')
  function search(event: SubmitEvent) {
    event.preventDefault()
    go('/search', { q: q.trim() })
  }
</script>

{#if stats.empty}
  <section class="welcome">
    <h1>{t('Welcome to Lagar')}</h1>
    <p class="big">{t('Your cellar is empty. Not a drop to drink, yet.')}</p>
    <p>{t('First step: bring your wines in. Open Settings, then Import your cellar: there is a template to download and instructions to fill it in, with a little help from an AI assistant.')}</p>
    <p class="actions">
      <a class="btn" href={href('/settings/import')}>{t('Import your cellar')}</a>
      <a class="btn secondary" href={href('/wine/new')}>{t('Or add one wine by hand')}</a>
    </p>
  </section>
{:else}
  <section class="stats" class:big aria-label={t('Cellar')}>
    <div class="stat"><span class="v">{num(stats.bottles)}</span><span class="l">{t('Bottles')}</span></div>
    <div class="stat"><span class="v">{num(stats.wines)}</span><span class="l">{t('Wines')}</span></div>
    <a class="stat now" href={href('/wines', { status: 'drink_now' })}><span class="v">{num(stats.drinkNow)}</span><span class="l">{t('Drink now')}</span></a>
  </section>

  <form class="search" role="search" onsubmit={search}>
    <button type="submit" aria-label={t('Search')}>
      <svg width="20" height="20" viewBox="0 0 20 20"><circle cx="8" cy="8" r="6" fill="none" stroke="#1B1815" stroke-width="2" /><path d="M12.5 12.5L18 18" fill="none" stroke="#1B1815" stroke-width="2" /></svg>
    </button>
    <input type="search" bind:value={q} placeholder={t('Search your cellar')} aria-label={t('Search your cellar')} />
  </form>

  {#if picks.red.length || picks.white.length}
    <section class="sec">
      <h2>{t('Suggestions')}</h2>
      {#if picks.red.length}<div class="sub-h">{t('Red')}</div><WineList rows={picks.red} />{/if}
      {#if picks.white.length}<div class="sub-h again">{t('White')}</div><WineList rows={picks.white} />{/if}
    </section>
  {/if}

  {#if picks.now.length}
    <section class="sec">
      <h2>{t('Drink now')}</h2>
      <WineList rows={picks.now} />
    </section>
  {/if}

  {#if stats.cost}
    <div class="cost"><span class="label">{t('Cellar cost')}</span><b>{eur(stats.cost, 2)}</b></div>
  {/if}
{/if}
