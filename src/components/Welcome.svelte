<script lang="ts">
  import { t } from '../lib/i18n/ui.svelte'
  import { href } from '../lib/router.svelte'
</script>

<!-- The empty cellar: the same message on Home and on the Wines page (Paper: "Home · empty cellar · welcome only"). -->
<section class="welcome">
  <h1>{t('Welcome to Lagar')}</h1>
  <p class="big">{t('Your cellar is empty. Not a drop to drink, yet.')}</p>
  <p>{t('First step: bring your wines in. Open Settings, then Import your cellar: there is a template to download and instructions to fill it in, with a little help from an AI assistant.')}</p>
  <a class="btn block" href={href('/settings/import')}>{t('Import your cellar')}</a>
  <p class="by-hand">{t('Just one bottle to start with? Add it by hand.')}</p>
  <a class="btn secondary block" href={href('/wine/new')}>{t('Add a wine')}</a>
  <div class="sample">
    <p>{t('Not sure yet? See how it works with made-up wines.')}</p>
    <a class="sample-link" href={href('/settings/import', { sample: '1' })}>{t('Try a sample cellar')}</a>
  </div>
</section>
