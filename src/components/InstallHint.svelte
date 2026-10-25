<script lang="ts">
  import { t } from '../lib/i18n/ui.svelte'
  import { hintSeen, isIos, isStandalone, markHintSeen } from '../lib/install.svelte'

  // Shown once, on iPhone and iPad only, and never inside the installed app.
  let show = $state(isIos() && !isStandalone() && !hintSeen())

  function close() {
    markHintSeen()
    show = false
  }
</script>

{#if show}
  <div class="guide-list" style="margin-top: 16px">
    <div class="guide-card">
      <strong>{t('Install the app')}</strong>
      <span>{t('On iPhone and iPad: tap the Share button, then “Add to Home Screen”.')}</span>
      <p class="actions" style="margin-top: 10px"><button class="btn secondary" type="button" onclick={close}>{t('Got it')}</button></p>
    </div>
  </div>
{/if}
