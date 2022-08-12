import { access, readFile } from "node:fs/promises"
// BUG: @types/nodeにfsPromises.constantsが無いので代用
// https://github.com/nodejs/node/issues/44209
import { constants } from "node:fs"
import { Channel } from "@slack/web-api/dist/response/ChannelsCreateResponse"

export interface SlackChannel {
  id: string
  name: string
  is_archived: boolean
  purpose: string
}

export const getSlackChannels = async (filePath: string) => {
  await access(filePath, constants.R_OK)
  const channelsFile = await readFile(filePath, "utf8")
  const channels = JSON.parse(channelsFile).map((channel: Channel) => ({
    id: channel.id,
    name: channel.name,
    is_archived: channel.is_archived,
    purpose: channel.purpose?.value
      ? channel.purpose.value.replaceAll("<http", "http").replaceAll(">", "")
      : "",
  })) as SlackChannel[]
  return channels
}
