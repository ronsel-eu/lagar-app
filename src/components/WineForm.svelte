<script lang="ts">
  import { WINE_TYPES } from '../lib/types'
  import { t } from '../lib/i18n/ui.svelte'
  import type { WineForm } from '../lib/wine'

  let { form = $bindable() }: { form: WineForm } = $props()

  const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
</script>

<!-- One form to add a wine and to edit it. -->
<div class="form-grid">
  <label>{t('Name')} <input type="text" bind:value={form.name} required /></label>
  <label>{t('Type')}
    <select bind:value={form.type}>
      <option value="">–</option>
      {#each WINE_TYPES as type (type)}<option value={type}>{t(cap(type))}</option>{/each}
    </select>
  </label>
  <label>{t('Vintage')} <input type="text" bind:value={form.vintage} placeholder={t('2019 or NV')} inputmode="numeric" /></label>
  <label>{t('Bottles')} <input type="text" bind:value={form.bottles} inputmode="numeric" /></label>
  <label>{t('Paid per bottle (€)')} <input type="text" bind:value={form.paid} inputmode="decimal" /></label>
  <label>{t('Producer')} <input type="text" bind:value={form.producer} /></label>
  <label>{t('Country')} <input type="text" bind:value={form.country} /></label>
  <label>{t('Region')} <input type="text" bind:value={form.region} /></label>
  <label>{t('Appellation')} <input type="text" bind:value={form.appellation} /></label>
  <label>{t('Grapes')} <input type="text" bind:value={form.grapes} /></label>
  <label>{t('Format (cl)')} <input type="text" bind:value={form.formatCl} placeholder="75" inputmode="decimal" /></label>
  <label>{t('Alcohol (%)')} <input type="text" bind:value={form.abv} inputmode="decimal" /></label>
  <label>{t('Critic points (50–100)')} <input type="text" bind:value={form.criticPoints} inputmode="decimal" /></label>
  <label>{t('Purchase date')} <input type="date" bind:value={form.purchaseDate} /></label>
</div>

<h3>{t('Your drinking window')}</h3>
<div class="form-grid">
  <label>{t('From year')} <input type="text" bind:value={form.windowFrom} inputmode="numeric" placeholder="2026" maxlength="4" /></label>
  <label>{t('To year')} <input type="text" bind:value={form.windowTo} inputmode="numeric" placeholder="2032" maxlength="4" /></label>
</div>
<p class="meta" style="margin: 0 0 6px; text-transform: none; letter-spacing: 0">{t('Leave both empty to follow the style rules.')}</p>

<h3>{t('More detail')}</h3>
<div class="form-grid wide">
  <label>{t('Serving temperature')}<textarea rows="2" bind:value={form.servingTemperature}></textarea></label>
  <label>{t('Food pairing')}<textarea rows="2" bind:value={form.foodPairing}></textarea></label>
  <label>{t('Appearance')}<textarea rows="2" bind:value={form.tastingAppearance}></textarea></label>
  <label>{t('Nose')}<textarea rows="2" bind:value={form.tastingNose}></textarea></label>
  <label>{t('Palate')}<textarea rows="2" bind:value={form.tastingPalate}></textarea></label>
</div>
