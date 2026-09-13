import {
  type Generated,
} from "kysely"
import { type DB, openDB, CoreDB, dbError } from "#src/db/common"

const ERROR_CHANNEL_DB = "error_report_channel"

type RawErrorChannelDB = {
  [ERROR_CHANNEL_DB]: {
    id: Generated<number>,
    channel_id: string,
  }
}

export class NoErrorReportChannel extends Error { };
export class ErrorSetFailure extends Error { };
export class ErrorRemoveFailure extends Error { };

class ErrorChannelDBImpl extends CoreDB<RawErrorChannelDB> {
  static open = async (path: string) => {
    return new ErrorChannelDBImpl(await openDB(path), ERROR_CHANNEL_DB)
  }

  init = async () => {
    try {
      await this.db.schema
        .createTable(ERROR_CHANNEL_DB)
        .ifNotExists()
        .addColumn("id", "integer", (col) => col.primaryKey())
        .addColumn("channel_id", "text", (col) => col.notNull())
        .execute()
    } catch (err) {
      dbError("initializing Error DB")
    }
  }

  enqueue = async (channel_id: string) => {
    const existingID = await this.db
      .selectFrom(ERROR_CHANNEL_DB)
      .selectAll()
      .executeTakeFirst()

    if (existingID !== undefined) {
      throw new ErrorSetFailure
    }

    await this.db
      .insertInto(ERROR_CHANNEL_DB)
      .values({ channel_id })
      .execute()
  }

  dequeue = async (channel_id: string) => {
    const deleteRes = await this.db
      .deleteFrom(ERROR_CHANNEL_DB)
      .where((exp) => exp("channel_id", "==", channel_id))
      .executeTakeFirst()

    if (deleteRes.numDeletedRows !== 1n) {
      throw new ErrorRemoveFailure
    }
  }

  getFirst = async () => {
    const id = await this.db
      .selectFrom(ERROR_CHANNEL_DB)
      .selectAll()
      .executeTakeFirst()

    if (id === undefined) {
      throw new NoErrorReportChannel
    }

    return id.channel_id
  }
}

export const ErrorDB: DB<RawErrorChannelDB, ErrorChannelDBImpl>
  = ErrorChannelDBImpl
