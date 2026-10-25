<script lang="ts">
  import { getStorage, reload } from '../lib/cellar.svelte'
  import { say } from '../lib/flash.svelte'
  import { t, ui } from '../lib/i18n/ui.svelte'
  import { go, href } from '../lib/router.svelte'
  import { formFrom, wineFromForm } from '../lib/wine'
  import WineForm from './WineForm.svelte'

  let form = $state(formFrom(null))

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    const result = wineFromForm(form, null, ui.lang)
    if (result.error !== undefined) {
      say(result.error, true, '/wine/new')
      window.scrollTo(0, 0)
      return
    }
    await getStorage().putWine(result.wine)
    await reload()
    say(t('Wine added.'), false, '/wine/' + result.wine.id)
    go('/wine/' + result.wine.id)
  }
</script>

<a class="back" href={href('/wines')}>
  <svg width="14" height="14" viewBox="0 0 14 14"><path d="M11 1L4 7L11 13" fill="none" stroke="#1B1815" stroke-width="2" /></svg>{t('Wines')}
</a>
<div class="phead"><h1>{t('Add a wine')}</h1></div>
<form class="wine-form formpad" onsubmit={submit}>
  <WineForm bind:form />
  <p><button class="btn" type="submit">{t('Add wine')}</button><a class="sub" href={href('/wines')}>{t('Cancel')}</a></p>
</form>
