/** A random id. crypto.randomUUID only exists on secure (https) pages, so build one from getRandomValues,
 *  which also works on the local http address used while developing. */
export function newId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
