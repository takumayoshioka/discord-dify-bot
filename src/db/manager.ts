import { join } from "node:path"

import {
  openChannelDB,
  channelDBOperations,
} from "#src/db/channel"
import {
  openMessageDB,
  messageDBOperations,
} from "#src/db/message"
import { rm, glob } from "node:fs/promises"

// export type and error
export {
  type TranslationDirection,
  NotTargetChannel,
  ChannelConnectionFailure,
  ChannelDisconnectionFailure
} from "#src/db/channel"

const DATABASE_PATH = join(
  process.cwd(), "db"
)
const CHANNEL_DATABASE_PATH = join(
  DATABASE_PATH, "ChannelDB.sqlite"
)
const MSG_DATABASE_PATH = join(
  DATABASE_PATH, "MsgDB.sqlite"
)

const MSG_DATABASE_PATH_RM = join(
  DATABASE_PATH, "MsgDB.*"
)

for await (const file of glob(MSG_DATABASE_PATH_RM)) {
  await rm(file, { force: true })
}

const rawChannelDB = await openChannelDB(CHANNEL_DATABASE_PATH)
const rawMsgDB = await openMessageDB(MSG_DATABASE_PATH)

export const channelDB = channelDBOperations(rawChannelDB)
export const messageDB = messageDBOperations(rawMsgDB)
