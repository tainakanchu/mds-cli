import { access, readFile } from "node:fs/promises"
// TODO: 後でfsPromise.constantsを使うようにする
import { constants } from "node:fs"
import { Channel as SlackChannel } from "@slack/web-api/dist/response/ChannelsCreateResponse"
import { ChannelType, Client, GatewayIntentBits } from "discord.js"
import type { Category } from "./category.mjs"

export interface Channel {
  slack: {
    channel_id: string
    channel_name: string
    is_archived: boolean
    purpose: string
  }
  discord: {
    channel_id: string
    channel_name: string
  }
}

export const getChannels = async (filePath: string) => {
  await access(filePath, constants.R_OK)
  const channelsFile = await readFile(filePath, "utf8")
  const channels = JSON.parse(channelsFile).map((channel: SlackChannel) => ({
    slack: {
      channel_id: channel.id,
      channel_name: channel.name,
      is_archived: channel.is_archived,
      purpose: channel.purpose?.value
        ? channel.purpose.value.replaceAll("<http", "http").replaceAll(">", "")
        : "",
    },
    discord: {
      channel_id: "",
      channel_name: channel.name,
    },
  })) as Channel[]
  return channels
}

export const createChannels = async (
  discordBotToken: string,
  discordServerId: string,
  channels: Channel[],
  defaultCategory: Category,
  archiveCategory: Category,
  isMigrateArchive: boolean
) => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  })
  await client.login(discordBotToken)

  const newChannels: Channel[] = []
  for (const channel of channels) {
    if (!channel.slack.is_archived || isMigrateArchive) {
      // チャンネルを作成する
      const result = await client.guilds.cache
        .get(discordServerId)
        ?.channels.create({
          name: channel.discord.channel_name,
          type: ChannelType.GuildText,
          parent: channel.slack.is_archived
            ? archiveCategory.id
            : defaultCategory.id,
        })
      // チャンネルのIDを更新する
      if (result?.id) {
        channel.discord.channel_id = result.id
      }
      newChannels.push(channel)
    }
  }

  return newChannels
}
