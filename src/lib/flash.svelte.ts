/** A message for the page it was meant for: a solid band (warn = something needs attention). It goes away when the person leaves that page. */
export const flash = $state<{ text: string; warn: boolean; path: string }>({ text: '', warn: false, path: '/' })

export function say(text: string, warn = false, path = '/settings') {
  flash.text = text
  flash.warn = warn
  flash.path = path
}
export function clearFlash() {
  flash.text = ''
}
