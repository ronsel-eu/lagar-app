<script lang="ts">
  import { onMount } from 'svelte'
  import { t } from '../lib/i18n/ui.svelte'

  let { text, warn = false, onclose }: { text: string; warn?: boolean; onclose: () => void } = $props()
  let gone = $state(false)

  function close() {
    gone = true
    setTimeout(onclose, 260)
  }
  onMount(() => {
    if (warn) return
    const timer = setTimeout(close, 7000)
    return () => clearTimeout(timer)
  })
</script>

<!-- One band for every message: ink = done (closes by itself after 7 seconds), wine-red = needs attention (stays until closed). -->
<div class="notice-wrap" class:gone>
  <div class="notice" class:warn role={warn ? 'alert' : 'status'} onclick={close} onkeydown={(e) => e.key === 'Escape' && close()} tabindex="-1">
    <div class="n-row">
      {#if warn}
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M11 3V13" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" /><rect x="9.8" y="16.5" width="2.4" height="2.4" fill="currentColor" /></svg>
      {:else}
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path class="tick" d="M3 11.5L9 17L19 5" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" /></svg>
      {/if}
      <div class="n-msg">{text}</div>
      <button class="n-x" type="button" aria-label={t('Close')}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2L12 12M12 2L2 12" stroke="currentColor" stroke-width="1.8" /></svg>
      </button>
    </div>
    {#if !warn}<div class="n-bar"></div>{/if}
  </div>
</div>
