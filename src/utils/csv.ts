import { getCellKey } from './cellKey'

function escapeCsvValue(value: string) {
  if (value === '') return ''
  const needsQuotes = /[",\n\r]/.test(value)
  if (!needsQuotes) return value
  return `"${value.replace(/"/g, '""')}"`
}

export function cellsToCsv(cells: Map<string, string>) {
  if (cells.size === 0) return ''

  let maxRow = 0
  let maxCol = 0
  for (const key of cells.keys()) {
    const [rowText, colText] = key.split(':')
    const row = Number(rowText)
    const col = Number(colText)
    if (Number.isFinite(row) && Number.isFinite(col)) {
      if (row > maxRow) maxRow = row
      if (col > maxCol) maxCol = col
    }
  }

  const rows: string[] = []
  for (let row = 0; row <= maxRow; row += 1) {
    const values: string[] = []
    for (let col = 0; col <= maxCol; col += 1) {
      const value = cells.get(getCellKey(row, col)) ?? ''
      values.push(escapeCsvValue(value))
    }
    rows.push(values.join(','))
  }

  return rows.join('\n')
}

type CsvParseState = {
  rows: string[][]
  row: string[]
  field: string
  inQuotes: boolean
}

function finalizeField(state: CsvParseState) {
  state.row.push(state.field)
  state.field = ''
}

function finalizeRow(state: CsvParseState) {
  finalizeField(state)
  state.rows.push(state.row)
  state.row = []
}

function parseCsv(text: string) {
  const state: CsvParseState = { rows: [], row: [], field: '', inQuotes: false }

  let i = 0
  while (i < text.length) {
    const char = text[i]
    if (state.inQuotes) {
      if (char === '"') {
        const nextChar = text[i + 1]
        if (nextChar === '"') {
          state.field += '"'
          i += 1
        } else {
          state.inQuotes = false
        }
      } else {
        state.field += char
      }
    } else {
      if (char === '"') {
        state.inQuotes = true
      } else if (char === ',') {
        finalizeField(state)
      } else if (char === '\n') {
        finalizeRow(state)
      } else if (char === '\r') {
        const nextChar = text[i + 1]
        if (nextChar === '\n') i += 1
        finalizeRow(state)
      } else {
        state.field += char
      }
    }
    i += 1
  }

  if (state.inQuotes) {
    state.inQuotes = false
  }
  if (state.field.length > 0 || state.row.length > 0) {
    finalizeRow(state)
  }

  return state.rows
}

export function csvToCells(text: string, maxRows: number, maxCols: number) {
  const rows = parseCsv(text)
  const cells = new Map<string, string>()

  for (let row = 0; row < rows.length && row < maxRows; row += 1) {
    const rowValues = rows[row]
    for (let col = 0; col < rowValues.length && col < maxCols; col += 1) {
      const value = rowValues[col]
      if (value !== '') {
        cells.set(getCellKey(row, col), value)
      }
    }
  }

  return cells
}
