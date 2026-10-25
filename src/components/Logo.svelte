<script lang="ts">
  import { t } from '../lib/i18n/ui.svelte'
  import { href } from '../lib/router.svelte'
  import type { Band } from '../lib/band'

  let { band, year }: { band: Band; year: number } = $props()
</script>

<!-- The label band: the same on every page; its colour changes each time the app is used. -->
<header class="logo {band}">
  <a class="brand" href={href('/')} aria-label={t('Lagar, home')}>
    <small>BODEGA</small>
    <div class="word"><i class="o">L</i><i class="t">A</i><i class="t">G</i><i class="t">A</i><i class="o">R</i></div>
    <small>COSECHA {year}</small>
  </a>
  <a class="plus" href={href('/wine/new')} aria-label={t('Add a wine')}>
    <svg width="18" height="18" viewBox="0 0 18 18"><path d="M9 1V17M1 9H17" fill="none" stroke="#F3F2ED" stroke-width="2.4" /></svg>
  </a>
</header>
