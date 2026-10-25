<script lang="ts">
  import { onMount } from 'svelte'
  import Home from './components/Home.svelte'
  import InstallHint from './components/InstallHint.svelte'
  import Import from './components/Import.svelte'
  import Logo from './components/Logo.svelte'
  import Notice from './components/Notice.svelte'
  import Search from './components/Search.svelte'
  import Settings from './components/Settings.svelte'
  import Tabs from './components/Tabs.svelte'
  import Guide from './components/Guide.svelte'
  import Guides from './components/Guides.svelte'
  import Opened from './components/Opened.svelte'
  import AddWine from './components/AddWine.svelte'
  import Wine from './components/Wine.svelte'
  import Wines from './components/Wines.svelte'
  import { toRows } from './lib/browse'
  import { currentBand } from './lib/band'
  import { cellar, initCellar } from './lib/cellar.svelte'
  import { clearFlash, flash } from './lib/flash.svelte'
  import { t, ui } from './lib/i18n/ui.svelte'
  import { route } from './lib/router.svelte'

  const year = new Date().getFullYear()
  let failed = $state(false)
  let band = $state(currentBand())

  const rows = $derived(toRows(cellar.wines, cellar.opened, year))
  const path = $derived(route.path)
  const isWinePage = $derived(/^\/wine\/(?!new$)[^/]+$/.test(path))

  onMount(() => {
    initCellar().catch(() => (failed = true))
  })

  // Every page keeps the band's colour while the app is in use; the time of use is renewed here.
  $effect(() => {
    void route.path
    band = currentBand()
    window.scrollTo(0, 0)
    if (flash.text && route.path !== flash.path) clearFlash()
  })
  $effect(() => {
    document.documentElement.lang = ui.lang
  })
</script>

<div class="app">
  {#if !isWinePage}<Logo {band} {year} />{/if}
  <main>
    {#if flash.text && path === flash.path && !isWinePage}<Notice text={flash.text} warn={flash.warn} onclose={clearFlash} />{/if}
    {#if failed}
      <p class="page-note">{t('The cellar on this device could not be opened.')}</p>
    {:else if cellar.ready}
      {#if path === '/'}
        <InstallHint />
        <Home {rows} {year} />
      {:else if path === '/wines'}
        <Wines {rows} />
      {:else if path === '/search'}
        <Search {rows} wines={cellar.wines} />
      {:else if path === '/settings'}
        <Settings />
      {:else if path === '/settings/import'}
        <Import />
      {:else if path === '/guides'}
        <Guides />
      {:else if path.startsWith('/guides/')}
        {#key path}<Guide slug={path.slice(8)} />{/key}
      {:else if path === '/opened'}
        <Opened />
      {:else if path === '/wine/new'}
        <AddWine />
      {:else if isWinePage}
        {#key path}<Wine id={decodeURIComponent(path.slice(6))} {year} />{/key}
      {:else}
        <p class="page-note">{t('Wine not found.')}</p>
      {/if}
    {/if}
  </main>
  <Tabs />
</div>
