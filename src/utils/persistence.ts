import { openDB, type DBSchema } from 'idb'

type WorkbookRecord = {
  cells: Array<[string, string]>
  updatedAt: number
}

type RalphDb = DBSchema & {
  workbooks: {
    key: string
    value: WorkbookRecord
  }
}

const DB_NAME = 'ralph-spreadsheet'
const DB_VERSION = 1
const STORE_NAME = 'workbooks'
const WORKBOOK_KEY = 'current'

let dbPromise: ReturnType<typeof openDB<RalphDb>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<RalphDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

export async function saveWorkbook(cells: Map<string, string>) {
  const db = await getDb()
  const payload: WorkbookRecord = {
    cells: Array.from(cells.entries()),
    updatedAt: Date.now(),
  }
  await db.put(STORE_NAME, payload, WORKBOOK_KEY)
}

export async function loadWorkbook() {
  const db = await getDb()
  const payload = await db.get(STORE_NAME, WORKBOOK_KEY)
  if (!payload) return null
  return new Map<string, string>(payload.cells)
}

export async function clearWorkbook() {
  const db = await getDb()
  await db.delete(STORE_NAME, WORKBOOK_KEY)
}
