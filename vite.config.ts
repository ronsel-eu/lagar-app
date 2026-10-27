import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { swPlugin } from './tools/sw-plugin'

// base './' keeps asset paths relative, so the same build works on
// GitHub Pages (a sub-path like /lagar-app/) and locally.
export default defineConfig({
  base: './',
  // The moment of the build, shown at the bottom of Settings so you can tell which version a device is running.
  // Older iPhones (Safari 14 and up) must be able to run the app too.
  build: { target: ['es2020', 'safari14'] },
  plugins: [svelte(), swPlugin()],
  test: { environment: 'node', include: ['src/**/*.test.ts', 'tools/**/*.test.ts'] },
})
