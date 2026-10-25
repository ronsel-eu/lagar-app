<script lang="ts">
  import { onMount } from 'svelte'
  import { openStorage, requestPersistence, type LagarStorage } from './lib/storage'
  import { createBackup, downloadBackup, restoreBackup, BackupError } from './lib/backup'
  import { adviceFor, type Status } from './lib/advice/engine'
  import { applyRows, message, previewImport, prompt, templateCsv, type ImportRow, type Issue, type Lang } from './lib/import/importer'
  import { downloadText } from './lib/download'
  import sampleCellar from './lib/import/sample-cellar.csv?raw'
  import type { Wine } from './lib/types'

  let storage: LagarStorage | undefined = $state()
  let persistent = $state(true)
  let protectedByBrowser = $state(false)
  let wines: Wine[] = $state([])
  let note = $state('')
  let lang: Lang = $state('en')

  let preview: ImportRow[] = $state([])
  let fatal: Issue | null = $state(null)
  let previewing = $state(false)

  const year = new Date().getFullYear()
  const LABEL: Record<Status, string> = { drink_now: 'Drink now', drink_soon: 'Drink soon', can_wait: 'Can wait', keep: 'Keep', evolves: 'Evolves' }

  async function refresh() {
    wines = storage ? (await storage.listWines()).sort((a, b) => a.name.localeCompare(b.name)) : []
  }

  onMount(async () => {
    const opened = await openStorage()
    storage = opened.storage
    persistent = opened.persistent
    protectedByBrowser = await requestPersistence()
    lang = ((await storage.getSetting('language')) as Lang | undefined) ?? 'en'
    await refresh()
  })

  async function setLang() {
    await storage?.setSetting('language', lang)
  }

  // ---- backup
  async function exportBackup() {
    if (!storage) return
    downloadBackup(await createBackup(storage))
    note = 'Backup file created. Look in your downloads.'
  }

  async function restore(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (!file || !storage) return
    try {
      const snapshot = await restoreBackup(storage, await file.text())
      note = `Restored ${snapshot.wines.length} wines.`
    } catch (e) {
      note = e instanceof BackupError ? e.message : 'The file could not be restored.'
    }
    input.value = ''
    await refresh()
  }

  // ---- import
  async function showPreview(raw: Uint8Array) {
    if (!storage) return
    const result = await previewImport(storage, raw)
    preview = result.rows
    fatal = result.fatal
    previewing = true
    note = ''
  }

  async function pickFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (file) await showPreview(new Uint8Array(await file.arrayBuffer()))
    input.value = ''
  }

  const trySample = () => showPreview(new TextEncoder().encode(sampleCellar))

  const changes = $derived(preview.filter((r) => r.action === 'new' || r.action === 'update').length)

  async function confirmImport() {
    if (!storage) return
    const { added, updated } = await applyRows(storage, preview)
    note = `Import done: ${added} added, ${updated} with more bottles.`
    previewing = false
    preview = []
    await refresh()
  }

  function cancelImport() {
    previewing = false
    preview = []
    fatal = null
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt(lang))
      note = 'Prompt copied. Paste it into your AI assistant.'
    } catch {
      note = 'Copying is not allowed here. Download the prompt instead.'
    }
  }
</script>

<main>
  <h1>Lagar</h1>
  <p class="soft">Test screen: data on this device, backup, import and drinking advice.</p>

  {#if !persistent}
    <p class="warn">The browser database is not available here (a private window?). Wines will be lost when you close the page.</p>
  {/if}

  <section>
    <h2>Language of the messages</h2>
    <select bind:value={lang} onchange={setLang}>
      <option value="en">English</option>
      <option value="es">Español</option>
      <option value="fr">Français</option>
    </select>
  </section>

  <section>
    <h2>Import your cellar</h2>
    <div class="row">
      <button onclick={() => downloadText('lagar-template.csv', templateCsv(), 'text/csv')}>Download the template</button>
      <button onclick={copyPrompt}>Copy the AI prompt</button>
      <button onclick={() => downloadText(`lagar-prompt-${lang}.txt`, prompt(lang))}>Download the prompt</button>
    </div>
    <div class="row">
      <label class="button">Choose a CSV file<input type="file" accept=".csv,text/csv,text/plain" onchange={pickFile} hidden /></label>
      <button onclick={trySample}>Try the sample cellar</button>
    </div>

    {#if previewing}
      <div class="preview">
        {#if fatal}
          <p class="warn">{message(fatal, lang)}</p>
        {:else}
          <ul class="rows">
            {#each preview as row (row.line)}
              <li class={row.action}>
                <strong>{row.action === 'error' ? row.form.name || '(no name)' : row.label}</strong>
                {#if row.action !== 'error'} {row.vintage ?? 'NV'} · {row.bottles} bottles{/if}
                <span class="tag">
                  {#if row.action === 'update'}{row.was} → {row.now}{:else}{row.action}{/if}
                </span>
                {#if row.error}<div class="issue">{message(row.error, lang)}</div>{/if}
                {#each row.warnings as w}<div class="issue">{message(w, lang)}</div>{/each}
              </li>
            {/each}
          </ul>
        {/if}
        <div class="row">
          {#if !fatal && changes > 0}<button class="primary" onclick={confirmImport}>Import ({changes})</button>{/if}
          <button onclick={cancelImport}>{fatal || changes === 0 ? 'Close' : 'Cancel'}</button>
        </div>
      </div>
    {/if}
  </section>

  <section>
    <h2>Your wines</h2>
    <p><strong>{wines.length}</strong> wines on this device{protectedByBrowser ? ' (protected from automatic cleaning)' : ''}.</p>
    <ul class="rows">
      {#each wines as wine (wine.id)}
        {@const advice = adviceFor(wine, year)}
        <li>
          <strong>{wine.name}</strong> {wine.vintage} · {wine.bottles} bottles
          <span class="tag {advice.status}">{LABEL[advice.status]}</span>
          <div class="issue">{advice.fromYear ?? '…'}–{advice.toYear ?? '…'} · {advice.note}</div>
        </li>
      {/each}
    </ul>
  </section>

  <section>
    <h2>Backup</h2>
    <div class="row">
      <button onclick={exportBackup}>Export backup</button>
      <label class="button">Restore backup<input type="file" accept="application/json,.json" onchange={restore} hidden /></label>
    </div>
  </section>

  {#if note}<p class="note">{note}</p>{/if}
</main>

<style>
  main { max-width: 36rem; margin: 0 auto; padding: 2rem 16px 4rem; }
  h1 { font-weight: 800; letter-spacing: -0.02em; margin-bottom: 0; }
  h2 { font-size: 1rem; margin: 2rem 0 0.5rem; }
  .soft { color: var(--soft); }
  .row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.5rem 0; }
  button, .button, select {
    font: inherit; padding: 0.55rem 0.9rem; border: 1px solid var(--ink); background: none; border-radius: 4px; cursor: pointer; color: inherit;
  }
  button.primary { background: var(--ink); color: var(--chalk); }
  .rows { list-style: none; padding: 0; margin: 0.75rem 0; }
  .rows li { padding: 0.6rem 0; border-top: 1px solid #d9dbde; }
  .tag { float: right; font-size: 0.8rem; color: var(--soft); }
  .tag.drink_now { color: #8a1c1c; font-weight: 700; }
  .tag.drink_soon { color: #9a5b00; font-weight: 700; }
  li.error { color: #b3261e; }
  .issue { font-size: 0.8rem; color: var(--soft); margin-top: 0.15rem; }
  li.error .issue { color: #b3261e; }
  .preview { margin-top: 1rem; border-left: 3px solid var(--ink); padding-left: 0.75rem; }
  .note { margin-top: 1rem; }
  .warn { border-left: 4px solid #b3261e; padding-left: 0.75rem; }
</style>
