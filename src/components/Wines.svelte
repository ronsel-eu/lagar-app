<script lang="ts">
  import { browse, FILTER_FIELDS, SORTS, STATES, STATUS_LABEL, type FilterField, type Row } from '../lib/browse'
  import { place, t, tn } from '../lib/i18n/ui.svelte'
  import { go, href, route } from '../lib/router.svelte'
  import type { Status } from '../lib/advice/engine'
  import Welcome from './Welcome.svelte'
  import WineList from './WineList.svelte'

  let { rows }: { rows: Row[] } = $props()

  const FILTER_LABEL: Record<FilterField, string> = {
    country: 'All countries', region: 'All regions', appellation: 'All appellations', colour: 'All types', grape: 'All grapes', year: 'All vintages',
  }

  const result = $derived(
    browse(rows, {
      state: route.params.get('state') ?? '',
      sort: route.params.get('sort') ?? '',
      status: route.params.get('status') ?? '',
      selection: Object.fromEntries(FILTER_FIELDS.map((f) => [f, route.params.get(f) ?? ''])),
    }),
  )

  /** Change one filter. The address holds all of them, so the back button and a reload keep the view. */
  function set(name: string, value: string) {
    const p = new URLSearchParams(route.params)
    if (value) p.set(name, value)
    else p.delete(name)
    go('/wines', p, true)
  }
  const onchange = (name: string) => (e: Event) => set(name, (e.currentTarget as HTMLSelectElement).value)

  const optionText = (field: FilterField, label: string) =>
    field === 'country' || field === 'region' ? place(label) : field === 'colour' ? t(label) : label
</script>

{#if rows.length === 0}
  <Welcome />
{:else}
<div class="phead">
  <h1>{result.status ? t(STATUS_LABEL[result.status]) : t('Wines')}</h1>
  <span class="meta">
    {result.rows.length} {tn(result.rows.length, 'wine', 'wines')}{#if result.state !== 'opened'} · {result.bottles} {tn(result.bottles, 'bottle', 'bottles')}{/if}
  </span>
</div>

<div class="filters">
  <select class:on={result.state !== 'present'} aria-label={t('Bottles')} value={result.state} onchange={onchange('state')}>
    {#each Object.entries(STATES) as [k, v] (k)}<option value={k}>{t(v)}</option>{/each}
  </select>
  <select aria-label={t('Order')} value={result.sort} onchange={onchange('sort')}>
    {#each Object.entries(SORTS) as [k, v] (k)}<option value={k}>{t(v)}</option>{/each}
  </select>
  {#each FILTER_FIELDS as f (f)}
    <select class:on={result.selection[f]} aria-label={t(FILTER_LABEL[f])} value={result.selection[f]} onchange={onchange(f)}>
      <option value="">{t(FILTER_LABEL[f])}</option>
      {#each result.options[f] as o (o.value)}<option value={o.value}>{optionText(f, o.label)} ({o.count})</option>{/each}
    </select>
  {/each}
  <select class="wide" class:on={result.status} aria-label={t('Drinking')} value={result.status} onchange={onchange('status')}>
    <option value="">{t('Any drinking status')}</option>
    {#each Object.entries(STATUS_LABEL) as [k, v] (k)}
      <option value={k} disabled={!result.statusCounts[k as Status]}>{t(v)} ({result.statusCounts[k as Status]})</option>
    {/each}
  </select>
  <div class="foot"><a href={href('/wines')}>{t('Clear filters')}</a></div>
</div>
<div style="height: 10px"></div>

{#if result.rows.length}
  <WineList rows={result.rows} showOpened={result.state !== 'present'} />
{:else}
  <p class="empty">{t('No wines match.')} <a href={href('/wines')}>{t('Clear filters')}</a></p>
{/if}
{/if}
