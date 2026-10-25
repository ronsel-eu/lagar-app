<script lang="ts">
  import { listGuides } from '../lib/guides/guides'
  import { t, ui } from '../lib/i18n/ui.svelte'
  import { href } from '../lib/router.svelte'

  const items = $derived(listGuides(ui.lang))
</script>

<div class="phead"><h1>{t('Guides')}</h1></div>
<div class="guide-list" style="margin-top: 14px">
  {#each items as g (g.slug)}
    <a class="guide-card" href={href('/guides/' + g.slug)}><strong>{g.title}</strong><span>{g.summary}</span></a>
  {/each}
</div>
