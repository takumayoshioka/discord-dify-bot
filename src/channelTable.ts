import { writeFile, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const channelIDSchema =
  z.string().regex(/^\d+$/, "channel ID must be a decimal string");

const channelPairSchema = z.object({
  ja: channelIDSchema,
  en: channelIDSchema
}).strict();

const channelTableSchema = z.object({
  channel_table: z.array(channelPairSchema)
}).strict();

type ChannelPair = Readonly<z.infer<typeof channelPairSchema>>;
type ChannelPairs = Array<ChannelPair>;
type ChannelTable = Readonly<z.infer<typeof channelTableSchema>>;

const readChannelTablePath = join(
  process.cwd(), "config.json"
);

const writeChannelTablePath = join(
  process.cwd(), "config.json.tmp"
)

let channelPairs: ChannelPairs = [];

const readChannelTable = async (): Promise<ChannelPairs> => {
  const fileText = await readFile(readChannelTablePath, "utf8");
  const channelTable = channelTableSchema.parse(JSON.parse(fileText));
  return channelTable.channel_table;
}

const existsOverlapChannelPair = (pair: ChannelPair): boolean => {
  return channelPairs.reduce((acc, nextPair) => {
    return acc || (
      nextPair.en === pair.en ||
      nextPair.en === pair.ja ||
      nextPair.ja === pair.en ||
      nextPair.ja === pair.ja
    );
  }, false);
}

const removeChannelPair = (pair: ChannelPair): [ChannelPairs, boolean] => {
  return channelPairs.reduce((
    [acc_pairs, acc_flag]: [ChannelPairs, boolean],
    nextPair
  ) => {
    if (
      (nextPair.en === pair.en && nextPair.ja === pair.ja) ||
      (nextPair.en === pair.ja && nextPair.ja === pair.en)
    ) {
      return [acc_pairs, true];
    } else {
      return [[...acc_pairs, pair], acc_flag];
    }
  }, [[], false]);
}

const getChannelTable = (): ChannelTable => {
  return { channel_table: channelPairs };
}

export const getChannelPairs = (): ChannelPairs => {
  return channelPairs;
}

// initialize internal state of channel pairs
export const initializeChannelTable = async (): Promise<void> => {
  channelPairs = (await readChannelTable());
}

const writeChannelTable = async () => {
  await writeFile(
    writeChannelTablePath,
    JSON.stringify(getChannelTable()),
    "utf8"
  );
  await rename(writeChannelTablePath, readChannelTablePath);
}

const pairValidation = (pair: ChannelPair): boolean => {
  return pair.en === pair.ja;
}

// add a new channel pair to channel pairs
// if there is no overlap, add it and return true
// otherwise, just return false
export const connectChannelPair = async (
  pair: ChannelPair
): Promise<boolean> => {
  if (pairValidation(pair)) { return false; }
  if (existsOverlapChannelPair(pair)) { return false; }

  channelPairs = [...channelPairs, pair];
  await writeChannelTable();
  return true;
}

// remove a channel pair if it exists 
// if there it is, remove it and return true
// otherwise, just return false
export const disconnectChannelPair = async (
  pair: ChannelPair
): Promise<boolean> => {
  const [nextChannelPairs, b] = removeChannelPair(pair);
  if (!b) { return false; }

  channelPairs = nextChannelPairs;
  await writeChannelTable();
  return true;
}