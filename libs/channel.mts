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
    topic: string
  }
}

/**
 * Get channel information
 * @param filePath
 * @returns Channel[]
 */
export const getChannels = async (filePath: string) => {
  await access(filePath, constants.R_OK)
  const channelsFile = await readFile(filePath, "utf8")
  const channels = JSON.parse(channelsFile).map((channel: SlackChannel) => ({
    slack: {
      channel_id: channel.id,
      channel_name: channel.name,
      is_archived: channel.is_archived,
      purpose: channel.purpose?.value ? channel.purpose.value : "",
    },
    discord: {
      channel_id: "",
      channel_name: channel.name,
      topic: channel.purpose?.value ? channel.purpose.value : "",
    },
  })) as Channel[]
  return channels
}

/**
 * Create channel
 * @param discordBotToken
 * @param discordServerId
 * @param channels
 * @param defaultCategory
 * @param archiveCategory
 * @param isMigrateArchive
 * @returns Channel[]
 */
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
          topic: channel.discord.topic ? channel.discord.topic : undefined,
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

/**
 * Delete channel
 * @param discordBotToken
 * @param discordServerId
 * @param channels
 * @returns Channel[]
 */
export const deleteChannels = async (
  discordBotToken: string,
  discordServerId: string,
  channels: Channel[]
) => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  })
  await client.login(discordBotToken)

  const newChannels: Channel[] = []
  for (const channel of channels) {
    // チャンネルを削除する
    await client.guilds.cache
      .get(discordServerId)
      ?.channels.delete(channel.discord.channel_id)
    // チャンネルのIDを削除する
    channel.discord.channel_id = ""
    newChannels.push(channel)
  }
  return newChannels
}
