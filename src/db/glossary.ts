import { type DB, CoreDB, dbError, openDB } from "#src/db/common"
import type { Generated } from "kysely"
import { parse } from "csv-parse/sync"
import { readFile } from "node:fs/promises"

export class GlossaryRemoveFailure extends Error { }

const GLOSSARY_DB_TABLE = "glossary_table"

// original (user-defined) properties
type OriginalGlossaryDB = {
  id: Generated<number>,
  ja: string,
  en: string,
  hiragana: string | null,
  katakana: string | null,
  ja_abb: string | null,
  en_abb: string | null
}

const searchPrefixes = [
  "ja_prefix", "hiragana_prefix", "katakana_prefix", "ja_abb_prefix"
] as const

// DB with prefixes for search queries
type RawGlossaryDB = {
  [GLOSSARY_DB_TABLE]: OriginalGlossaryDB & {
    [K in typeof searchPrefixes[number]]: string | null
  }
}

// generates prefixes for search queries
function genPrefix(str: string): string
function genPrefix(str: string | null): string | null
function genPrefix(str: string | null) {
  if (str === null) { return null }
  return str.slice(0, 2)
}

class GlossaryDBImple extends CoreDB<RawGlossaryDB> {
  static open = async (path: string) => {
    return new GlossaryDBImple(await openDB(path), GLOSSARY_DB_TABLE)
  }

  init = async () => {
    try {
      let initQuery =
        this.db.schema
          .createTable(GLOSSARY_DB_TABLE)
          .ifNotExists()
          .addColumn("id", "integer", (col) => col.primaryKey())
          .addColumn("ja", "text", (col) => col.notNull())
          .addColumn("en", "text", (col) => col.notNull())
          .addColumn("hiragana", "text")
          .addColumn("katakana", "text")
          .addColumn("ja_abb", "text")
          .addColumn("en_abb", "text")

      for (const key of searchPrefixes) {
        initQuery = initQuery.addColumn(key, "text")
      }

      await initQuery.execute()
      await this.readCSV()
    } catch (_) {
      return dbError("initializing connection db")
    }
  }

  readCSV = async () => {
    const csvRows = parse<Record<string, string>>(
      await readFile("Glossary.csv"),
      { columns: true, bom: true, skip_empty_lines: true }
    ) as Record<
      "日本語" | "英語" | "読み（ひらがな）" | "読み（かたかな）" | "日本語（略称）" | "英語（略称）",
      string
    >[]

    const dbRows = csvRows.map((row, i) => {
      const ja = row["日本語"]
      const en = row["英語"]
      const hiragana = row["読み（ひらがな）"]
      const katakana = row["読み（かたかな）"]
      const ja_abb = row["日本語（略称）"]
      const en_abb = row["英語（略称）"]
      const ja_prefix = genPrefix(ja)
      const hiragana_prefix = genPrefix(hiragana)
      const katakana_prefix = genPrefix(katakana)
      const ja_abb_prefix = genPrefix(ja_abb)

      return {
        id: i + 1,
        ja,
        en,
        hiragana,
        katakana,
        ja_abb,
        en_abb,
        ja_prefix,
        hiragana_prefix,
        katakana_prefix,
        ja_abb_prefix
      }
    })

    await this.db.transaction().execute(async trx => {
      await trx.deleteFrom(GLOSSARY_DB_TABLE).execute()

      if (dbRows.length > 0) {
        await trx.insertInto(GLOSSARY_DB_TABLE).values(dbRows).execute()
      }
    })
  }

  // enqueue row into DB
  enqueue = async (
    ja: string,
    en: string,
    hiragana: string | null,
    katakana: string | null,
    ja_abb: string | null,
    en_abb: string | null
  ) => {
    const ja_prefix = genPrefix(ja)
    const hiragana_prefix = genPrefix(hiragana)
    const katakana_prefix = genPrefix(katakana)
    const ja_abb_prefix = genPrefix(ja_abb)

    const newRow = {
      ja,
      en,
      hiragana,
      katakana,
      ja_abb,
      en_abb,
      ja_prefix,
      hiragana_prefix,
      katakana_prefix,
      ja_abb_prefix
    }

    await this.db.insertInto(GLOSSARY_DB_TABLE)
      .values(newRow)
      .onConflict(conflict => conflict.column("id").doUpdateSet(newRow))
      .execute()
  }

  // delete already sent content
  dequeue = async (key: string) => {
    const deleteRes = await this.db
      .deleteFrom(GLOSSARY_DB_TABLE)
      .where((exp) =>
        exp.or([
          exp("ja", "==", key),
          exp("en", "==", key)
        ]))
      .executeTakeFirst()

    if (deleteRes.numDeletedRows !== 1n) {
      throw new GlossaryRemoveFailure
    }
  }

  // generates indices
  createIndex = async () => {
    for (const col of searchPrefixes) {
      await this.db.schema
        .createIndex(`${col}_index`)
        .on(GLOSSARY_DB_TABLE)
        .column(col)
        .execute()
    }
  }

  // search rows by prefixes
  searchByPrefixes = async (prefixes: string[]) => {
    return await this.db.selectFrom(GLOSSARY_DB_TABLE)
      .select(["ja", "hiragana", "katakana", "ja_abb", "en", "en_abb"])
      .where(eb => eb.or([
        eb("ja_prefix", "in", prefixes),
        eb("hiragana_prefix", "in", prefixes),
        eb("katakana_prefix", "in", prefixes),
        eb("ja_abb_prefix", "in", prefixes),
      ]))
      .execute()
  }
}

export const GlossaryDB: DB<RawGlossaryDB, GlossaryDBImple> = GlossaryDBImple