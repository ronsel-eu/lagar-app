<script lang="ts">
  let count = $state(0)
</script>

<main>
  <h1>Lagar</h1>
  <p>Hello from the new app. Nothing is stored yet.</p>
  <button onclick={() => count++}>Tapped {count} times</button>
</main>

<style>
  main { max-width: 32rem; margin: 0 auto; padding: 2rem 16px; }
  h1 { font-weight: 800; letter-spacing: -0.02em; }
  p { color: var(--soft); }
  button { font: inherit; padding: 0.6rem 1rem; border: 1px solid var(--ink); background: none; border-radius: 4px; }
</style>
