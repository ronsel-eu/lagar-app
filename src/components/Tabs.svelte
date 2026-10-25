<script lang="ts">
  import { t } from '../lib/i18n/ui.svelte'
  import { href, route } from '../lib/router.svelte'

  const path = $derived(route.path)
</script>

<div class="tabbar">
  <nav class="tabs" aria-label={t('Main')}>
    <a href={href('/')} class:on={path === '/'}>{t('Home')}</a>
    <a href={href('/wines')} class:on={path.startsWith('/wine') || path === '/search'}>{t('Wines')}</a>
    <a href={href('/guides')} class:on={path.startsWith('/guides')}>{t('Guides')}</a>
    <a href={href('/settings')} class:on={path.startsWith('/settings')}>{t('Settings')}</a>
  </nav>
</div>
