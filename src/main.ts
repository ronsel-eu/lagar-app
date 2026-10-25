import { mount } from 'svelte'
import './fonts.css'
import './app.css'
import App from './App.svelte'
import { watchInstall } from './lib/install.svelte'

const app = mount(App, { target: document.getElementById('app')! })

// The offline copy: only in the real build, never while developing.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
watchInstall()

export default app
