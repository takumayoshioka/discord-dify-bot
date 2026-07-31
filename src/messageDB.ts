import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import Database from "better-sqlite3";
import {
  type Generated,
  Kysely,
  NoResultError,
  SqliteDialect
} from "kysely";

const MSG_DATABASE_PATH = join(
  process.cwd(), "db", "MsgDB.sqlite"
)

const MSG_DB_TABLE = "translation_queue";

interface RawMsgDB {
  [MSG_DB_TABLE]: {
    id: Generated<number>,
    target_channel_id: string,
    original_content: string,
    translated_content: string | null,
    display_name: string,
    avatar_url: string
  }
}

export type MsgDB = Kysely<RawMsgDB>;

// open SQLiteDB file and returns it as DB
const openSQLiteDB = async () => {
  try {
    await mkdir(dirname(MSG_DATABASE_PATH), { recursive: true });

    const sqlite = new Database(MSG_DATABASE_PATH);

    try {
      sqlite.pragma("journal_mode = WAL");
      return sqlite;
    } catch (err) {
      sqlite.close();
      throw err;
    }
  } catch (err) {
    throw new Error(
      `Cannot create SQLite DB: ${MSG_DATABASE_PATH}`
    )
  }
}

// initialize DB with Kysely
export const openMsgDB = async () => {
  const sqlite = await openSQLiteDB();

  return new Kysely<RawMsgDB>({
    dialect: new SqliteDialect({
      database: sqlite
    })
  })
}

// initialize DB
export const initMsgDB = async (msgDB: Kysely<RawMsgDB>) => {
  try {
    await msgDB.schema
      .createTable(MSG_DB_TABLE)
      .ifNotExists()
      .addColumn("id", "integer", (col) => col.primaryKey())
      .addColumn("target_channel_id", "text", (col) => col.notNull())
      .addColumn("original_content", "text", (col) => col.notNull())
      .addColumn("translated_content", "text")
      .addColumn("display_name", "text", (col) => col.notNull())
      .addColumn("avatar_url", "text")
      .execute();
  } catch (err) {
    throw new Error(
      `Failed to initialize message translation db`
    );
  }
}

// enqueue row into DB
export const enqueueMsgDB = async (
  msgDB: Kysely<RawMsgDB>,
  target_channel_id: string,
  original_content: string,
  display_name: string,
  avatar_url: string
) => {
  try {
    const insertedRow = await msgDB
      .insertInto(MSG_DB_TABLE)
      .values({
        target_channel_id,
        original_content,
        translated_content: null,
        display_name,
        avatar_url
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return insertedRow.id;
  } catch (err) {
    if (err instanceof NoResultError) {
      return null;
    } else {
      throw err;
    }
  }
}

// update translated content by id
export const setTranslatedContentMsgDB = async (
  msgDB: Kysely<RawMsgDB>, id: number, translated_content: string
) => {
  await msgDB
    .updateTable("translation_queue")
    .set({ translated_content })
    .where("id", "==", id)
    .execute()
}

// returns translated result (or null) by channel ID 
export const getTranslatedContentMsgDB = async (
  msgDB: Kysely<RawMsgDB>, target_channel_id: string
) => {
  return await msgDB
    .selectFrom(MSG_DB_TABLE)
    .selectAll()
    .where("target_channel_id", "==", target_channel_id)
    .orderBy("id", "asc")
    .limit(1)
    .executeTakeFirst();
}

// delete already sent content
export const deleteTranslatedContentMsgDB = async (
  msgDB: Kysely<RawMsgDB>, id: number
) => {
  await msgDB
    .deleteFrom(MSG_DB_TABLE)
    .where("id", "==", id)
    .execute();
}