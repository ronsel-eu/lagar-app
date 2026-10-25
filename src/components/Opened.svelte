<script lang="ts">
  import { cellar, undoOpenedBottle } from '../lib/cellar.svelte'
  import { dmy } from '../lib/format'
  import { t, tn } from '../lib/i18n/ui.svelte'
  import { href, winesHref } from '../lib/router.svelte'

  const names = $derived(new Map(cellar.wines.map((w) => [w.id, w.name])))
  // Newest first. Bottles opened on the same day are listed by wine name.
  const rows = $derived(
    [...cellar.opened].sort((a, b) =>
      a.date !== b.date ? (a.date < b.date ? 1 : -1) : (names.get(a.wineId) ?? '').localeCompare(names.get(b.wineId) ?? ''),
    ),
  )
  const bottles = $derived(rows.reduce((n, r) => n + r.qty, 0))
</script>

<a class="back" href={winesHref()}>
  <svg width="14" height="14" viewBox="0 0 14 14"><path d="M11 1L4 7L11 13" fill="none" stroke="#1B1815" stroke-width="2" /></svg>{t('Wines')}
</a>
<div class="phead">
  <h1>{t('Opened')}</h1>
  <span class="meta">{rows.length} {tn(rows.length, 'record', 'records')}{#if rows.length} · {bottles} {tn(bottles, 'bottle', 'bottles')}{/if}</span>
</div>
<div style="height: 10px"></div>
<div class="table-wrap">
  <table class="wines">
    <thead><tr><th>{t('Date')}</th><th>{t('Wine')}</th><th class="r">{t('Bottles')}</th><th>{t('Occasion')}</th><th></th></tr></thead>
    <tbody>
      {#each rows as r (r.id)}
        <tr>
          <td>{dmy(r.date)}</td>
          <td>
            <a href={href('/wine/' + r.wineId)}>{names.get(r.wineId) ?? '–'}</a>
            {#if r.note}<br /><span class="meta">{r.note}</span>{/if}
          </td>
          <td class="r">{r.qty}</td>
          <td>{r.occasion ?? ''}</td>
          <td class="r"><button class="link" type="button" onclick={() => undoOpenedBottle(r.id)}>{t('Undo')}</button></td>
        </tr>
      {:else}
        <tr><td colspan="5" class="empty">–</td></tr>
      {/each}
    </tbody>
  </table>
</div>
