/** A tiny router on the address hash (#/wines?state=opened), so the app works from any folder or sub-path with no server rules. */

export const route = $state<{ path: string; params: URLSearchParams }>({ path: '/', params: new URLSearchParams() })

// The filters last used on the Wines list, so coming back from a wine finds the list as it was left.
let winesQuery = ''

function read() {
  const [path, query] = (location.hash.slice(1) || '/').split('?')
  if (path === '/wines') winesQuery = query ?? ''
  route.path = path || '/'
  route.params = new URLSearchParams(query ?? '')
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', read)
  read()
}

export type Params = Record<string, string> | URLSearchParams

export function href(path: string, params?: Params): string {
  const query = params ? new URLSearchParams(params).toString() : ''
  return '#' + path + (query ? '?' + query : '')
}

/** Go to a page. `replace` changes the address without adding a step to the back button (filters use it). */
export function go(path: string, params?: Params, replace = false) {
  const target = href(path, params)
  if (replace) history.replaceState(null, '', target)
  else location.hash = target
  read()
}

/** The Wines list with the filters it had when the person left it. */
export function winesHref(): string {
  return '#/wines' + (winesQuery ? '?' + winesQuery : '')
}

/** Back to the Wines list, filters included. */
export function goWines() {
  location.hash = winesHref()
  read()
}
