<script lang="ts">
  import type { Row } from '../lib/browse'
  import { eur } from '../lib/format'
  import { place, t, tn } from '../lib/i18n/ui.svelte'
  import { href } from '../lib/router.svelte'

  let { rows, showOpened = false }: { rows: Row[]; showOpened?: boolean } = $props()
</script>

<!-- One wine per row, the same in every list: type band, name in bold and bottles; then appellation, winery, vintage and price. -->
<ul class="wlist">
  {#each rows as r (r.id)}
    <li>
      <a class="wrow {r.type ?? 'none'}" href={href('/wine/' + r.id)}>
        <span class="wband"><span></span></span>
        <span class="wbody">
          <strong class="wname">{r.name}</strong>
          <span class="wmeta">{r.appellation || place(r.region) || place(r.country) || '–'} · {r.producer || '–'} · {r.vintage || '–'} · {r.price ? eur(r.price, 2) : '–'}</span>
        </span>
        {#if r.tag}
          <span class="wright tag {r.tag}">{t(r.tag)}</span>
        {:else}
          <span class="wright">&times;{r.bottles}{#if showOpened && r.openedN}<span class="o">{r.openedN} {tn(r.openedN, 'opened|one', 'opened')}</span>{/if}</span>
        {/if}
      </a>
    </li>
  {/each}
</ul>
