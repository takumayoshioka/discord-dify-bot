import {
  type Generated,
} from "kysely"
import { type DB, openDB, CoreDB } from "#src/db/common"

const DAJARE_DB_TABLE = "dajare_table"

type RawDajareDB = {
  [DAJARE_DB_TABLE]: {
    id: Generated<number>,
    channel_id: string,
  }
}

export class NotDajareChannel extends Error { };
export class DajareSetFailure extends Error { };
export class DajareRemoveFailure extends Error { };

class DajareDBImple extends CoreDB<RawDajareDB> {
  static open = async (path: string) => {
    return new DajareDBImple(await openDB(path), DAJARE_DB_TABLE)
  }

  // initialize DB
  init = async () => {
    try {
      await this.db.schema
        .createTable(DAJARE_DB_TABLE)
        .ifNotExists()
        .addColumn("id", "integer", (col) => col.primaryKey())
        .addColumn("channel_id", "text", (col) => col.notNull())
        .execute()
    } catch (err) {
      throw new Error(
        `Failed to initialize dajare db`
      )
    }
  }

  // enqueue row into DB
  enqueue = async (
    channel_id: string,
  ) => {
    const existingPair = await this.db
      .selectFrom(DAJARE_DB_TABLE)
      .selectAll()
      .where((exp) => exp("channel_id", "==", channel_id))
      .executeTakeFirst()

    if (existingPair !== undefined) {
      throw new DajareSetFailure
    }

    await this.db
      .insertInto(DAJARE_DB_TABLE)
      .values({ channel_id })
      .execute()
  }

  // delete already sent content
  dequeue = async (channel_id: string) => {
    const deleteRes = await this.db
      .deleteFrom(DAJARE_DB_TABLE)
      .where((exp) => exp("channel_id", "==", channel_id))
      .executeTakeFirst()

    if (deleteRes.numDeletedRows !== 1n) {
      throw new DajareRemoveFailure
    }
  }

  checkTarget = async (channel_id: string) => {
    const res = await this.db
      .selectFrom(DAJARE_DB_TABLE)
      .selectAll()
      .where((exp) => exp("channel_id", "==", channel_id))
      .execute()

    for (const { id: _, channel_id: channel_id_res } of res) {
      if (channel_id === channel_id_res) { return true }
    }
    return false
  }

  // return all dajare channels
  getAll = async () => {
    const table = await this.db
      .selectFrom(DAJARE_DB_TABLE)
      .selectAll()
      .execute()

    return table.map(({ id: _id, channel_id }) => {
      return { channel_id }
    })
  }
}

export const DajareDB: DB<RawDajareDB, DajareDBImple> = DajareDBImple