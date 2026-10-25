// Installing the app on the home screen: Android offers a button, iPhone needs a hint.

interface InstallEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const install = $state<{ event: InstallEvent | null; done: boolean }>({ event: null, done: false })

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

/** iPhone and iPad (new iPads say they are Macs, but have a touch screen). */
export function isIos(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)
}

export function watchInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    install.event = e as InstallEvent
  })
  window.addEventListener('appinstalled', () => {
    install.event = null
    install.done = true
  })
}

export async function promptInstall() {
  const e = install.event
  if (!e) return
  await e.prompt()
  await e.userChoice
  install.event = null
}

const HINT_KEY = 'lagar-ios-hint'
export function hintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === '1'
  } catch {
    return true
  }
}
export function markHintSeen() {
  try {
    localStorage.setItem(HINT_KEY, '1')
  } catch {
    /* no storage: the hint just shows again next time */
  }
}
