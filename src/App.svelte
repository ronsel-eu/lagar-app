<script lang="ts">
  import { onMount } from 'svelte'
  import { openStorage, requestPersistence, type LagarStorage } from './lib/storage'
  import { createBackup, downloadBackup, restoreBackup, BackupError } from './lib/backup'
  import { newId } from './lib/ids'
  import type { Wine } from './lib/types'

  let storage: LagarStorage | undefined = $state()
  let persistent = $state(true)
  let protectedByBrowser = $state(false)
  let wines: Wine[] = $state([])
  let message = $state('')

  async function refresh() {
    wines = storage ? await storage.listWines() : []
  }

  onMount(async () => {
    const opened = await openStorage()
    storage = opened.storage
    persistent = opened.persistent
    protectedByBrowser = await requestPersistence()
    await refresh()
  })

  async function addSample() {
    if (!storage) return
    const n = wines.length + 1
    const wine: Wine = {
      id: newId(), name: `Test wine ${n}`, vintage: 2015 + (n % 8), bottles: 3, type: 'red',
      producer: null, country: 'Spain', region: null, appellation: null, grapes: null, abv: null, formatCl: 75,
      paid: 20, purchaseDate: null, addedAt: new Date().toISOString(),
      ownWindow: null, servingTemperature: null, foodPairing: null, tastingAppearance: null, tastingNose: null, tastingPalate: null,
      criticsOpinion: null,
    }
    await storage.putWine(wine)
    await refresh()
    message = ''
  }

  async function exportBackup() {
    if (!storage) return
    downloadBackup(await createBackup(storage))
    message = 'Backup file created. Look in your downloads.'
  }

  async function restore(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file || !storage) return
    try {
      const snapshot = await restoreBackup(storage, await file.text())
      message = `Restored ${snapshot.wines.length} wines.`
    } catch (e) {
      message = e instanceof BackupError ? e.message : 'The file could not be restored.'
    }
    input.value = ''
    await refresh()
  }
</script>

<main>
  <h1>Lagar</h1>
  <p class="soft">Step 2 test screen: data stored on this device, with backup and restore.</p>

  {#if !persistent}
    <p class="warn">The browser database is not available here (a private window?). Wines will be lost when you close the page.</p>
  {/if}

  <p><strong>{wines.length}</strong> wines saved on this device{protectedByBrowser ? ' (protected from automatic cleaning)' : ''}.</p>
  <ul>
    {#each wines as wine (wine.id)}
      <li>{wine.name} {wine.vintage} · {wine.bottles} bottles</li>
    {/each}
  </ul>

  <div class="row">
    <button onclick={addSample}>Add a test wine</button>
    <button onclick={exportBackup}>Export backup</button>
    <label class="button">Restore backup<input type="file" accept="application/json,.json" onchange={restore} hidden /></label>
  </div>

  {#if message}<p class="note">{message}</p>{/if}
</main>

<style>
  main { max-width: 32rem; margin: 0 auto; padding: 2rem 16px; }
  h1 { font-weight: 800; letter-spacing: -0.02em; }
  .soft { color: var(--soft); }
  ul { padding-left: 1.2rem; }
  .row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
  button, .button {
    font: inherit; padding: 0.6rem 1rem; border: 1px solid var(--ink); background: none; border-radius: 4px; cursor: pointer;
  }
  .note { margin-top: 1rem; }
  .warn { border-left: 4px solid #b3261e; padding-left: 0.75rem; }
</style>
