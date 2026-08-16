import { join } from "node:path"

import {
  ConnectDB
} from "#src/db/connect"
import {
  MessageDB
} from "#src/db/message"
import { rm, glob } from "node:fs/promises"

// export type and error
export {
  type TranslationDirection,
  NotTargetChannel,
  ChannelConnectionFailure,
  ChannelDisconnectionFailure
} from "#src/db/connect"

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

export const connectDB = await ConnectDB.open(CHANNEL_DATABASE_PATH)
export const messageDB = await MessageDB.open(MSG_DATABASE_PATH)
