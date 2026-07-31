import { join } from "node:path"
import {
  openChannelDB,
  channelDBOperations,
} from "./channelDB.js"
import {
  openMessageDB,
  messageDBOperations,
} from "./messageDB.js"

export {
  type TranslationDirection,
  NotTargetChannel,
  ChannelConnectionFailure,
  ChannelDisconnectionFailure
} from "./channelDB.js"

const CHANNEL_DATABASE_PATH = join(
  process.cwd(), "db", "ChannelDB.sqlite"
)
const MSG_DATABASE_PATH = join(
  process.cwd(), "db", "MsgDB.sqlite"
)

const rawChannelDB = await openChannelDB(CHANNEL_DATABASE_PATH);
const rawMsgDB = await openMessageDB(MSG_DATABASE_PATH);

export const channelDB = {
  ...channelDBOperations(rawChannelDB)
};

export const messageDB = {
  ...messageDBOperations(rawMsgDB)
};
