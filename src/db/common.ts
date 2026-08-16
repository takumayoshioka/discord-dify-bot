import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"

import Database from "better-sqlite3"
import {
  Kysely,
  SqliteDialect
} from "kysely"

// open SQLiteDB file and returns it as DB
const openSQLiteDB = async (path: string) => {
  try {
    await mkdir(dirname(path), { recursive: true })

    const sqlite = new Database(path)

    try {
      sqlite.pragma("journal_mode = WAL")
      return sqlite
    } catch (err) {
      sqlite.close()
      throw err
    }
  } catch (err) {
    throw new Error(
      `Cannot create SQLite DB: ${path}`
    )
  }
}

// initialize DB with Kysely
export const openDB = async <DB>(path: string) => {
  const sqlite = await openSQLiteDB(path)

  return new Kysely<DB>({
    dialect: new SqliteDialect({
      database: sqlite
    })
  })
}

export type DB<RawDB, OpenedDB extends CoreDB<RawDB>> = {
  open: (path: string) => Promise<OpenedDB>
}

export abstract class CoreDB<RawDB> {
  constructor(
    protected readonly db: Kysely<RawDB>,
    protected readonly tableName: keyof RawDB & string
  ) { }

  reset = async () => {
    await this.db.deleteFrom(this.tableName).execute()
  }

  abstract enqueue: (...items: never[]) => Promise<unknown>
  abstract dequeue: (...items: never[]) => Promise<unknown>
}