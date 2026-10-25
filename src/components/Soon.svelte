<script lang="ts">
  import { t } from '../lib/i18n/ui.svelte'

  let { title }: { title: string } = $props()
</script>

<div class="phead"><h1>{t(title)}</h1></div>
<p class="page-note">{t('This part of the app is being built. It comes in the next steps.')}</p>
