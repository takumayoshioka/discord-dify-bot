import {
  type Generated,
} from "kysely"
import { type DB, openDB, CoreDB } from "#src/db/common"

const CONNECT_DB_TABLE = "channel_pair_queue"

type RawConnectDB = {
  [CONNECT_DB_TABLE]: {
    id: Generated<number>,
    ja_channel_id: string,
    en_channel_id: string,
  }
}

export class NotTargetChannel extends Error { };
export class ChannelConnectionFailure extends Error { };
export class ChannelDisconnectionFailure extends Error { };

type JA_TO_EN = "ja-to-en"
type EN_TO_JA = "en-to-ja"
export type TranslationDirection = JA_TO_EN | EN_TO_JA
export type TranslationTarget = {
  channelID: string
  direction: TranslationDirection
}

class ConnectDBImpl extends CoreDB<RawConnectDB> {
  static open = async (path: string) => {
    return new ConnectDBImpl(await openDB(path), CONNECT_DB_TABLE)
  }

  // initialize DB
  init = async () => {
    try {
      await this.db.schema
        .createTable(CONNECT_DB_TABLE)
        .ifNotExists()
        .addColumn("id", "integer", (col) => col.primaryKey())
        .addColumn("ja_channel_id", "text", (col) => col.notNull())
        .addColumn("en_channel_id", "text", (col) => col.notNull())
        .execute()
    } catch (err) {
      throw new Error(
        `Failed to initialize message translation db`
      )
    }
  }

  // return pair opponent 
  getTargetChannel = async (
    channelID: string
  ): Promise<TranslationTarget> => {
    const targetChannelIDDir =
      await this.db
        .selectFrom(CONNECT_DB_TABLE)
        .where((exp) =>
          exp.or([
            exp("ja_channel_id", "==", channelID),
            exp("en_channel_id", "==", channelID),
          ]))
        .select((exp) => {
          const isJa = exp("ja_channel_id", "==", channelID)

          return [
            exp.case()
              .when(isJa)
              .then(exp.ref("en_channel_id"))
              .else(exp.ref("ja_channel_id"))
              .end()
              .as("channelID"),
            exp.case()
              .when(isJa)
              .then("ja-to-en" as JA_TO_EN)
              .else("en-to-ja" as EN_TO_JA)
              .end()
              .as("direction"),
          ]
        })
        .executeTakeFirst()

    if (!targetChannelIDDir) { throw new NotTargetChannel }

    return targetChannelIDDir
  }

  // enqueue row into DB
  enqueue = async (
    ja_channel_id: string,
    en_channel_id: string,
  ) => {
    const existingPair = await this.db
      .selectFrom(CONNECT_DB_TABLE)
      .selectAll()
      .where((exp) =>
        exp.or([
          exp("ja_channel_id", "in", [ja_channel_id, en_channel_id]),
          exp("en_channel_id", "in", [ja_channel_id, en_channel_id]),
        ])
      )
      .executeTakeFirst()

    if (existingPair || ja_channel_id === en_channel_id) {
      throw new ChannelConnectionFailure
    }

    await this.db
      .insertInto(CONNECT_DB_TABLE)
      .values({ ja_channel_id, en_channel_id })
      .execute()
  }

  // delete already sent content
  dequeue = async (ja_channel_id: string, en_channel_id: string) => {
    const deleteRes = await this.db
      .deleteFrom(CONNECT_DB_TABLE)
      .where((exp) =>
        exp.or([
          exp.and([
            exp("ja_channel_id", "==", ja_channel_id),
            exp("en_channel_id", "==", en_channel_id),
          ]),
          exp.and([
            exp("ja_channel_id", "==", en_channel_id),
            exp("en_channel_id", "==", ja_channel_id),
          ]),
        ]))
      .executeTakeFirst()

    if (deleteRes.numDeletedRows !== 1n) {
      throw new ChannelDisconnectionFailure
    }
  }

  // return all channel pairs
  getAll = async () => {
    const table = await this.db
      .selectFrom(CONNECT_DB_TABLE)
      .selectAll()
      .execute()

    return table.map(({ id: _id, ja_channel_id, en_channel_id }) => {
      return { ja_channel_id, en_channel_id }
    })
  }
}

export const ConnectDB: DB<RawConnectDB, ConnectDBImpl> = ConnectDBImpl