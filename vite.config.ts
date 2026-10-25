import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// base './' keeps asset paths relative, so the same build works on
// GitHub Pages (a sub-path like /lagar-app/) and locally.
export default defineConfig({
  base: './',
  plugins: [svelte()],
})
