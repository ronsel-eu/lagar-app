<script lang="ts">
  import { adviceFor } from '../lib/advice/engine'
  import { sectionFor } from '../lib/guides/guides'
  import { cellar, getStorage, reload, undoOpenedBottle } from '../lib/cellar.svelte'
  import { clearFlash, flash, say } from '../lib/flash.svelte'
  import { dmy, eur } from '../lib/format'
  import { place, t } from '../lib/i18n/ui.svelte'
  import { ui } from '../lib/i18n/ui.svelte'
  import { goWines, href, route, winesHref } from '../lib/router.svelte'
  import { drinkView, formFrom, nameParts, openBottle, todayIso, wineFromForm } from '../lib/wine'
  import Notice from './Notice.svelte'
  import WineForm from './WineForm.svelte'

  let { id, year }: { id: string; year: number } = $props()

  const wine = $derived(cellar.wines.find((w) => w.id === id))
  const advice = $derived(wine ? adviceFor(wine, year) : null)
  const view = $derived(advice ? drinkView(advice) : null)
  const parts = $derived(wine ? nameParts(wine.name) : null)
  const opened = $derived(cellar.opened.filter((o) => o.wineId === id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)))
  const here = $derived('/wine/' + id)
  // A window read from a style rule links to the table it comes from.
  const table = $derived(advice?.source === 'rule' ? sectionFor(advice.note) : null)

  // The page is rebuilt for each wine ({#key} in App), so the starting value is the right one.
  // svelte-ignore state_referenced_locally
  let form = $state(formFrom(wine ?? null))
  let editOpen = $state(false)
  let editBox: HTMLElement | undefined = $state()
  let openForm = $state({ date: todayIso(), qty: 1, occasion: '', note: '' })

  const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
  const comma = (n: number) => String(n).replace('.', ',')
  const tell = (key: string, params?: Record<string, string | number>, warn = false) => {
    say(t(key, params), warn, here)
    window.scrollTo(0, 0)
  }

  async function save(event: SubmitEvent) {
    event.preventDefault()
    if (!wine) return
    const result = wineFromForm(form, wine, ui.lang)
    if (result.error !== undefined) {
      say(result.error, true, here)
      window.scrollTo(0, 0)
      return
    }
    await getStorage().putWine(result.wine)
    await reload()
    form = formFrom(result.wine)
    tell('Saved.')
  }

  async function remove() {
    if (!wine || !confirm(t('Delete this wine?'))) return
    await getStorage().deleteWine(wine.id)
    await reload()
    say(t('Wine deleted.'), false, '/wines')
    goWines()
  }

  async function open(event: SubmitEvent) {
    event.preventDefault()
    if (!wine) return
    const result = openBottle(wine, { ...openForm, qty: Number(openForm.qty) })
    if (!result.ok) return tell(result.say.key, result.say.params, true)
    await getStorage().putWine(result.wine)
    await getStorage().putOpened(result.record)
    await reload()
    openForm = { date: todayIso(), qty: 1, occasion: '', note: '' }
    tell(result.say.key, result.say.params)
  }

  async function undo(recordId: string) {
    await undoOpenedBottle(recordId)
    form = formFrom(cellar.wines.find((w) => w.id === id) ?? null)
  }
</script>

<div class="navrow">
  <a class="back" href={winesHref()}>
    <svg width="14" height="14" viewBox="0 0 14 14"><path d="M11 1L4 7L11 13" fill="none" stroke="#1B1815" stroke-width="2" /></svg>{t('Wines')}
  </a>
</div>
{#if flash.text && flash.path === route.path}<Notice text={flash.text} warn={flash.warn} onclose={clearFlash} />{/if}

{#if !wine || !view || !parts}
  <p class="page-note">{t('Wine not found.')}</p>
{:else}
  <section class="nameband {wine.type ?? ''}">
    <div class="nb-top">
      <div>
        <div class="nb-small">{wine.type ? t(cap(wine.type)) : ''}{#if wine.appellation || wine.region}{' · '}{wine.appellation || place(wine.region)}{/if}</div>
        <div class="nb-small">{wine.producer ?? ''}</div>
      </div>
      <div class="nb-year">{wine.vintage}</div>
    </div>
    {#if parts.pre}<div class="nb-pre" style="font-size: {parts.pre.size}px; letter-spacing: {parts.pre.tracking}">{parts.pre.text}</div>{/if}
    <div class="nb-main" style="font-size: {parts.main.size}px">{parts.main.text}</div>
    {#if parts.post}<div class="nb-post" style="font-size: {parts.post.size}px; letter-spacing: {parts.post.tracking}">{parts.post.text}</div>{/if}
  </section>

  <section class="drink">
    <div>
      <div class="label">{t('Drink')}</div>
      <div class="big" class:now={advice?.status === 'drink_now'}>{t(view.word)}</div>
    </div>
    <div class="until">{#if view.until}{t(view.until.key, { year: view.until.year })}{/if}</div>
  </section>
  <div class="why">
    {#if view.note}<p>{view.note}</p>{/if}
    <p>
      {t(view.help)} {t('Source: {source}.', { source: t(view.source) })}
      {#if table}<a class="table-link" href={href('/guides/consumption-windows', { at: table })}>{t('See the table')}</a>{/if}
    </p>
  </div>

  <section class="nums">
    <div><b>{wine.bottles}</b><span class="label">{t('Bottles')}</span></div>
    <div><b>{wine.paid ? eur(wine.paid, 2) : '–'}</b><span class="label">{t('Paid')}</span></div>
  </section>

  <dl class="kvs">
    <div class="kv"><dt>{t('Grapes')}</dt><dd>{wine.grapes || '–'}</dd></div>
    <div class="kv"><dt>{t('Serving')}</dt><dd>{wine.servingTemperature || '–'}</dd></div>
    <div class="kv"><dt>{t('Food pairing')}</dt><dd>{wine.foodPairing || '–'}</dd></div>
  </dl>

  <details class="more">
    <summary>{t('More detail')}</summary>
    <dl class="kvs inner">
      <div class="kv"><dt>{t('Appellation')}</dt><dd>{wine.appellation || '–'}</dd></div>
      <div class="kv"><dt>{t('Appearance')}</dt><dd>{wine.tastingAppearance || '–'}</dd></div>
      <div class="kv"><dt>{t('Nose')}</dt><dd>{wine.tastingNose || '–'}</dd></div>
      <div class="kv"><dt>{t('Palate')}</dt><dd>{wine.tastingPalate || '–'}</dd></div>
      <div class="kv"><dt>{t('Points')}</dt><dd>{wine.criticPoints ?? '–'}</dd></div>
      <div class="kv"><dt>{t('Format')}</dt><dd>{#if wine.formatCl}{comma(wine.formatCl)} cl{#if wine.abv} · {comma(wine.abv)}%{/if}{:else}–{/if}</dd></div>
      <div class="kv"><dt>{t('Last purchase')}</dt><dd>{wine.purchaseDate ? dmy(wine.purchaseDate) : '–'}</dd></div>
    </dl>

    {#if opened.length}
      <h3>{t('Opened')}</h3>
      <table class="wines">
        <thead><tr><th>{t('Date')}</th><th class="r">{t('Bottles')}</th><th>{t('Occasion')}</th><th></th></tr></thead>
        <tbody>
          {#each opened as o (o.id)}
            <tr>
              <td>{dmy(o.date)}</td>
              <td class="r">{o.qty}</td>
              <td>{o.occasion ?? ''}{#if o.note}<br /><span class="meta">{o.note}</span>{/if}</td>
              <td class="r"><button class="link" type="button" onclick={() => undo(o.id)}>{t('Undo')}</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </details>

  <details class="more edit" bind:open={editOpen} bind:this={editBox}>
    <summary>{t('Edit this wine')}</summary>
    <form class="wine-form" onsubmit={save}>
      <WineForm bind:form />
      <p><button class="btn" type="submit">{t('Save')}</button></p>
    </form>
    <button class="link" type="button" onclick={remove}>{t('Delete this wine')}</button>
  </details>

  <details class="openbox">
    <summary>{t('Open a bottle')}</summary>
    {#if wine.bottles < 1}
      <p class="meta">{t('None left')}</p>
    {:else}
      <form onsubmit={open}>
        <label>{t('Date')} <input type="date" bind:value={openForm.date} /></label>
        <label>{t('Bottles')} <input type="number" bind:value={openForm.qty} min="1" max={wine.bottles} /></label>
        <label>{t('Occasion')} <input type="text" bind:value={openForm.occasion} placeholder={t('Dinner with friends, birthday...')} /></label>
        <label>{t('Note')} <input type="text" bind:value={openForm.note} placeholder={t('How was it?')} /></label>
        <button type="submit">{t('Mark as opened')}</button>
      </form>
    {/if}
  </details>
{/if}
