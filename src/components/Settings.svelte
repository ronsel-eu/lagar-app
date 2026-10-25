<script lang="ts">
  import { BackupError, createBackup, downloadBackup, restoreBackup } from '../lib/backup'
  import { cellar, getStorage, reload, setLanguage } from '../lib/cellar.svelte'
  import { say } from '../lib/flash.svelte'
  import { LANGS, type Lang } from '../lib/i18n'
  import { t, ui } from '../lib/i18n/ui.svelte'
  import { href } from '../lib/router.svelte'

  async function exportBackup() {
    downloadBackup(await createBackup(getStorage()))
    say(t('Backup file created. Look in your downloads.'))
  }

  async function restore(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      const snapshot = await restoreBackup(getStorage(), await file.text())
      await reload()
      say(t('Restored {n} wines.', { n: snapshot.wines.length }))
    } catch (e) {
      say(e instanceof BackupError ? e.message : t('The file could not be restored.'), true)
    }
    input.value = ''
  }
</script>

<div class="phead"><h1>{t('Settings')}</h1></div>

<section class="sec">
  <h2>{t('Language')}</h2>
  <div class="langs">
    {#each Object.entries(LANGS) as [code, name] (code)}
      <button type="button" class:on={code === ui.lang} aria-current={code === ui.lang ? 'true' : undefined} onclick={() => setLanguage(code as Lang)}>{name}</button>
    {/each}
  </div>
  <p class="lead">{t('Wine descriptions and drinking advice are still in English.')}</p>
</section>

<div class="guide-list" style="margin-top: 28px">
  <a class="guide-card" href={href('/settings/import')}>
    <strong>{t('Import your cellar')}</strong>
    <span>{t('Load your wines from a CSV file. Download the template, or let an AI assistant fill it from your spreadsheet, notes or photos.')}</span>
  </a>
</div>

<div class="guide-list">
  <a class="guide-card" href={href('/opened')}>
    <strong>{t('Opened bottles')}</strong>
    <span>{t('Every bottle you have opened, newest first, with the occasion.')}</span>
  </a>
</div>

<section class="sec">
  <h2>{t('Backup')}</h2>
  <p class="lead">{t('Your wines live on this device only. A backup file lets you keep a copy or move them to another device.')}{cellar.protectedByBrowser ? ' ' + t('The browser will not clean them up by itself.') : ''}</p>
  {#if !cellar.persistent}<p class="lead">{t('The browser database is not available here (a private window?). Wines will be lost when you close the page.')}</p>{/if}
  <p class="actions" style="display: flex; flex-wrap: wrap; gap: 10px">
    <button class="btn secondary" type="button" onclick={exportBackup}>{t('Export backup')}</button>
    <label class="btn secondary" style="margin: 0">{t('Restore backup')}<input type="file" accept="application/json,.json" onchange={restore} hidden /></label>
  </p>
</section>
