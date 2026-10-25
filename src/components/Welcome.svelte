<script lang="ts">
  import { t } from '../lib/i18n/ui.svelte'
  import { href } from '../lib/router.svelte'
</script>

<!-- The empty cellar: the same message on Home and on the Wines page (Paper: "Home · empty cellar · welcome only"). -->
<section class="welcome">
  <h1>{t('Welcome to Lagar')}</h1>
  <p class="big">{t('Your cellar is empty. Not a drop to drink, yet.')}</p>
  <p>{t('First step: bring your wines in. Open Settings, then Import your cellar: there is a template to download and instructions to fill it in, with a little help from an AI assistant.')}</p>
  <p class="actions">
    <a class="btn" href={href('/settings/import')}>{t('Import your cellar')}</a>
    <a class="btn secondary" href={href('/wine/new')}>{t('Or add one wine by hand')}</a>
  </p>
</section>
