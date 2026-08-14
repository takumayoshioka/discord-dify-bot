import {
  type Generated,
  Kysely,
  NoResultError,
} from "kysely"
import { openDB } from "#src/db/common"

const MSG_DB_TABLE = "translation_queue"

interface RawMsgDB {
  [MSG_DB_TABLE]: {
    id: Generated<number>,
    target_channel_id: string,
    original_content: string,
    translated_content: string | null,
    attachment_json: string,
    display_name: string,
    avatar_url: string
  }
}

export const openMessageDB = openDB<RawMsgDB>

export const messageDBOperations = (
  msgDB: Kysely<RawMsgDB>
) => {
  // initialize DB
  const init = async () => {
    try {
      await msgDB.schema
        .createTable(MSG_DB_TABLE)
        .ifNotExists()
        .addColumn("id", "integer", (col) => col.primaryKey())
        .addColumn("target_channel_id", "text", (col) => col.notNull())
        .addColumn("original_content", "text", (col) => col.notNull())
        .addColumn("translated_content", "text")
        .addColumn("attachment_json", "text", (col) => col.notNull())
        .addColumn("display_name", "text", (col) => col.notNull())
        .addColumn("avatar_url", "text")
        .execute()
    } catch (err) {
      throw new Error(
        `Failed to initialize message translation db`
      )
    }
  }

  // reset DB
  const reset = async () => {
    await msgDB.deleteFrom(MSG_DB_TABLE).execute()
  }

  // enqueue row into DB without translated_content
  const enqueue = async (
    target_channel_id: string,
    original_content: string,
    attachment_json: string,
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
          attachment_json,
          display_name,
          avatar_url
        })
        .returning("id")
        .executeTakeFirstOrThrow()
      return insertedRow.id
    } catch (err) {
      if (err instanceof NoResultError) {
        return null
      } else {
        throw err
      }
    }
  }

  // enqueue row into DB with all information
  const enqueueAll = async (
    target_channel_id: string,
    original_content: string,
    translated_content: string,
    attachment_json: string,
    display_name: string,
    avatar_url: string
  ) => {
    try {
      const insertedRow = await msgDB
        .insertInto(MSG_DB_TABLE)
        .values({
          target_channel_id,
          original_content,
          translated_content,
          attachment_json,
          display_name,
          avatar_url
        })
        .returning("id")
        .executeTakeFirstOrThrow()
      return insertedRow.id
    } catch (err) {
      if (err instanceof NoResultError) {
        return null
      } else {
        throw err
      }
    }
  }

  // update translated content by id
  const setTranslatedContent = async (
    id: number, translated_content: string
  ) => {
    await msgDB
      .updateTable("translation_queue")
      .set({ translated_content })
      .where("id", "==", id)
      .execute()
  }

  // returns translated result (or null) by channel ID 
  const getTranslatedContent = async (
    target_channel_id: string
  ) => {
    return await msgDB
      .selectFrom(MSG_DB_TABLE)
      .selectAll()
      .where("target_channel_id", "==", target_channel_id)
      .orderBy("id", "asc")
      .limit(1)
      .executeTakeFirst()
  }

  // delete already sent content
  const dequeue = async (
    id: number
  ) => {
    await msgDB
      .deleteFrom(MSG_DB_TABLE)
      .where("id", "==", id)
      .execute()
  }

  return {
    init,
    reset,
    enqueue,
    enqueueAll,
    setTranslatedContent,
    getTranslatedContent,
    dequeue
  }
}