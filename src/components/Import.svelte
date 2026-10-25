<script lang="ts">
  import { cellar, getStorage, reload } from '../lib/cellar.svelte'
  import { say } from '../lib/flash.svelte'
  import { downloadText } from '../lib/download'
  import { t, ui } from '../lib/i18n/ui.svelte'
  import {
    applyRows, message, previewImport, prompt, TEMPLATE_COLUMNS, templateCsv, type ImportRow, type Issue,
  } from '../lib/import/importer'
  import sampleCellar from '../lib/import/sample-cellar.csv?raw'
  import { go, href } from '../lib/router.svelte'

  let rows: ImportRow[] = $state([])
  let fatal: Issue | null = $state(null)
  let filename = $state('')
  let checked = $state(false)
  let copied = $state('')

  const count = (action: string) => rows.filter((r) => r.action === action).length
  const nNew = $derived(count('new'))
  const nUpdate = $derived(count('update'))
  const nSame = $derived(count('same'))
  const nError = $derived(count('error'))

  async function check(raw: Uint8Array, name: string) {
    const result = await previewImport(getStorage(), raw)
    rows = result.rows
    fatal = result.fatal
    filename = name
    checked = true
    window.scrollTo(0, 0)
  }

  async function pick(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (file) await check(new Uint8Array(await file.arrayBuffer()), file.name)
    input.value = ''
  }

  let pasted = $state('')
  const checkPasted = () => check(new TextEncoder().encode(pasted), t('Pasted text'))

  const trySample = () => check(new TextEncoder().encode(sampleCellar), 'sample-cellar.csv')

  function back() {
    checked = false
    rows = []
    fatal = null
  }

  let busy = $state(false)

  async function confirm() {
    if (busy) return
    busy = true
    try {
      const { added, updated } = await applyRows(getStorage(), $state.snapshot(rows) as ImportRow[])
      await reload()
      const parts = [
        ...(added ? [t(added === 1 ? '{n} wine added' : '{n} wines added', { n: added })] : []),
        ...(updated ? [t(updated === 1 ? '{n} bottle count updated' : '{n} bottle counts updated', { n: updated })] : []),
      ]
      say(parts.length ? t('Import done: {parts}.', { parts: parts.join(', ') }) : t('Nothing to import.'))
      go('/settings')
    } catch (e) {
      // Never fail silently: say what went wrong, on this same page.
      say(t('The import failed: {error}', { error: e instanceof Error ? e.message : String(e) }), true, '/settings/import')
      window.scrollTo(0, 0)
    } finally {
      busy = false
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt(ui.lang))
      copied = t('Copied')
    } catch {
      copied = t('Select and copy')
    }
  }

  const rowText = (r: ImportRow) =>
    r.action === 'new' ? t('Add')
    : r.action === 'update' ? t((r.bottles ?? 0) === 1 ? 'Add {n} bottle' : 'Add {n} bottles', { n: r.bottles ?? 0 })
    : r.action === 'same' ? t('Already there')
    : t('Skipped')
</script>

{#if !checked}
  <a class="back" href={href('/settings')}>
    <svg width="14" height="14" viewBox="0 0 14 14"><path d="M11 1L4 7L11 13" fill="none" stroke="#1B1815" stroke-width="2" /></svg>{t('Settings')}
  </a>
  <div class="phead"><h1>{t('Import your cellar')}</h1></div>

  <section class="sec">
    <h2>{t('1 · Get your wines into a CSV')}</h2>
    <p class="lead">{t('Lagar reads one simple format: a CSV file with one row per wine and vintage. Download the template, fill it in yourself, or ask an AI assistant to do it for you.')}</p>
    <p><button class="btn secondary" type="button" onclick={() => downloadText('lagar-template.csv', templateCsv(), 'text/csv')}>{t('Download the template')}</button></p>
    <p class="lead">{t('Only {required} are required. Everything else is optional.', { required: 'name, vintage, bottles' })}</p>
    <p class="cols">{#each TEMPLATE_COLUMNS as c (c)}<code>{c}</code>{/each}</p>
  </section>

  <section class="sec">
    <h2>{t('2 · Or let an AI assistant do it')}</h2>
    <p class="lead">{t('Open your favourite assistant (Claude, ChatGPT, Gemini…), paste this text, and attach your spreadsheet, notes, shop orders or photos of your labels. It will return the CSV.')}</p>
    <p class="lead">{t('The text for the assistant is in English; assistants understand it whatever your language.')}</p>
    <pre class="prompt">{prompt(ui.lang)}</pre>
    <p><button class="btn secondary" type="button" onclick={copyPrompt}>{copied || t('Copy the text')}</button></p>
    <p class="lead">{t('Always glance at the result before uploading: assistants sometimes get a vintage or a type wrong. You will see everything in a preview before anything is saved.')}</p>
  </section>

  <section class="sec">
    <h2>{t('3 · Upload it')}</h2>
    <p><input type="file" onchange={pick} /></p>
    <p class="lead">{t('Cannot pick the file? Open it, copy all its text and paste it here.')}</p>
    <p><textarea bind:value={pasted} rows="4" aria-label={t('The CSV text')} style="width: 100%; font: 13px/1.3 monospace; box-sizing: border-box"></textarea></p>
    {#if pasted.trim()}<p><button class="btn secondary" type="button" onclick={checkPasted}>{t('Check the text')}</button></p>{/if}
    {#if cellar.wines.length === 0}<p><button class="btn secondary" type="button" onclick={trySample}>{t('Try a sample cellar')}</button></p>{/if}
    <p class="lead">{t('Nothing is saved yet, and nothing is ever deleted. A wine that is not in Lagar is added; a wine that is already there gets the bottles in the file added to its stock.')}</p>
  </section>
{:else}
  <button class="back" type="button" onclick={back} style="background: none; border: 0; font-family: inherit; cursor: pointer; color: inherit">
    <svg width="14" height="14" viewBox="0 0 14 14"><path d="M11 1L4 7L11 13" fill="none" stroke="#1B1815" stroke-width="2" /></svg>{t('Import')}
  </button>
  <div class="phead"><h1>{t('Check the import')}</h1><span class="meta">{filename}</span></div>

  {#if fatal}
    <div class="notice-wrap" style="margin-top: 14px"><div class="notice warn" role="alert"><div class="n-row"><div class="n-msg">{message(fatal, ui.lang)}</div></div></div></div>
  {:else}
    <dl class="imp-sum">
      <div><dt>{t('New')}</dt><dd>{nNew}</dd></div>
      <div><dt>{t('Restock')}</dt><dd>{nUpdate}</dd></div>
      <div><dt>{t('Same')}</dt><dd>{nSame}</dd></div>
      <div><dt>{t('Skipped')}</dt><dd>{nError}</dd></div>
    </dl>
    {#if nNew || nUpdate}
      <div class="formpad">
        <p>
          <button class="btn" type="button" onclick={confirm} disabled={busy}>
            {busy ? t('Importing…') : nUpdate ? t('Import {n} new and restock {m}', { n: nNew, m: nUpdate }) : t('Import {n} new', { n: nNew })}
          </button>
          <button class="link sub" type="button" onclick={back} style="margin-left: 12px">{t('Cancel')}</button>
        </p>
      </div>
    {:else}
      <p class="empty">{t('There is nothing to import from this file.')}</p>
    {/if}
    <div class="table-wrap">
      <table class="wines preview">
        <thead><tr><th>#</th><th>{t('Wine')}</th><th class="r">{t('Bottles')}</th><th>{t('What happens')}</th></tr></thead>
        <tbody>
          {#each rows as r (r.line)}
            <tr class="imp-{r.action}">
              <td>{r.line}</td>
              <td>
                {r.action === 'error' && !r.label ? r.form.name || '–' : r.label}
                {#if r.label}<span class="meta">{r.vintage ?? 'NV'}</span>{/if}
                {#each r.warnings as w}<br /><span class="why">{message(w, ui.lang)}</span>{/each}
              </td>
              <td class="r">{#if r.action === 'update'}{r.was} → {r.now}{:else if r.bottles != null}{r.bottles}{/if}</td>
              <td>{rowText(r)}{#if r.action === 'error' && r.error}<br /><span class="why">{message(r.error, ui.lang)}</span>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}
