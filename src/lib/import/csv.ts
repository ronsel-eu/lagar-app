/**
 * A small CSV reader with the same behaviour as Python's csv.reader (the original importer used it):
 * quoted cells may hold the delimiter, doubled quotes and line breaks; a quote in the middle of an unquoted cell is
 * just a character; a blank line is a record with no cells. Lines end with LF, CRLF or a lone CR.
 */
export function parseCsv(text: string, delimiter: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let cell = ''
  let inQuotes = false
  let started = false // something has been read since the last line end
  let i = 0
  const endCell = () => { record.push(cell); cell = '' }
  const endRecord = () => { records.push(record); record = []; started = false }

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue }
        inQuotes = false
        i++
        continue
      }
      cell += ch
      i++
      continue
    }
    // a quote opens a quoted cell only at the very start of a cell
    if (ch === '"' && cell === '') {
      inQuotes = true
      started = true
      i++
      continue
    }
    if (ch === delimiter) { endCell(); started = true; i++; continue }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      i++
      if (started || cell !== '' || record.length > 0) endCell()
      endRecord()
      continue
    }
    cell += ch
    started = true
    i++
  }
  if (started || cell !== '' || record.length > 0) {
    endCell()
    endRecord()
  }
  return records
}
