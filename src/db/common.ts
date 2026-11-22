import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import Database from "better-sqlite3"
import {
  Kysely,
  SqliteDialect
} from "kysely"

import { InternalError } from "#src/util/utilities"

export class DBError extends InternalError {
  from: string
  constructor(name: string, from: string, cause?: Error) {
    super(name)
    this.from = from
    this.cause = cause
  }

  override toString = () => {
    const errMsg = (this.cause && this.cause instanceof Error)
      ? `:\n\`\`\n${this.cause?.toString()}\n\`\`\`` : ""
    return `DB  Error comes from ${this.from}${errMsg}`
  }
}

export const dbError = (from: string, err: unknown): never => {
  throw new DBError(
    "DB Error",
    from,
    (err instanceof Error) ? err : undefined
  )
}

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
    return dbError(`creating SQLite DB (path: ${path})`, err)
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

  abstract init: () => Promise<void>
  abstract enqueue: (...items: never[]) => Promise<unknown>
  abstract dequeue: (...items: never[]) => Promise<unknown>
}