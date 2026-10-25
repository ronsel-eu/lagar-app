import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { swPlugin } from './tools/sw-plugin'

// base './' keeps asset paths relative, so the same build works on
// GitHub Pages (a sub-path like /lagar-app/) and locally.
export default defineConfig({
  base: './',
  plugins: [svelte(), swPlugin()],
  test: { environment: 'node', include: ['src/**/*.test.ts', 'tools/**/*.test.ts'] },
})
