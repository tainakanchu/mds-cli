import { access, readFile } from "node:fs/promises"
// TODO: 後でfsPromise.constantsを使うようにする
import { constants } from "node:fs"
import { join } from "node:path"
import { Channel as SlackChannel } from "@slack/web-api/dist/response/ChannelsCreateResponse"
import { ChannelType, Client, GatewayIntentBits } from "discord.js"
import type { Category } from "./category.mjs"
import { getMessageFilePaths } from "./message.mjs"

export interface Channel {
  slack: {
    channel_id: string
    channel_name: string
    is_archived: boolean
    purpose: string
    message_file_paths: string[]
  }
  discord: {
    channel_id: string
    channel_name: string
    topic: string
    message_file_paths: string[]
  }
}

/**
 *  * Convert channel information
 * @param channelFilePath
 * @param srcMessageDirPath
 * @param distMessageDirPath
 * @returns Channel[]
 */
export const convertChannels = async (
  channelFilePath: string,
  srcMessageDirPath: string,
  distMessageDirPath: string
) => {
  await access(channelFilePath, constants.R_OK)
  const slackChannels = JSON.parse(
    await readFile(channelFilePath, "utf8")
  ) as SlackChannel[]

  const newChannels: Channel[] = []
  for (const channel of slackChannels) {
    if (channel.name) {
      // Slackのメッセージファイルのパスを取得する
      const srcMessageFilePaths = await getMessageFilePaths(
        join(srcMessageDirPath, channel.name)
      )

      // Discordのメッセージファイルのパスを算出する
      const distMessageFilePaths = srcMessageFilePaths.map((messageFilePath) =>
        messageFilePath.replace(srcMessageDirPath, distMessageDirPath)
      )

      newChannels.push({
        slack: {
          channel_id: channel.id || "",
          channel_name: channel.name || "",
          is_archived: channel.is_archived || false,
          purpose: channel.purpose?.value ? channel.purpose.value : "",
          message_file_paths: srcMessageFilePaths,
        },
        discord: {
          channel_id: "",
          channel_name: channel.name || "",
          topic: channel.purpose?.value ? channel.purpose.value : "",
          message_file_paths: distMessageFilePaths,
        },
      })
    }
  }
  return newChannels
}

/**
 * Create channel
 * @param discordBotToken
 * @param discordServerId
 * @param channels
 * @param defaultCategory
 * @param archiveCategory
 * @param migrateArchive
 * @returns Channel[]
 */
export const createChannels = async (
  discordBotToken: string,
  discordServerId: string,
  channels: Channel[],
  defaultCategory: Category,
  archiveCategory: Category,
  migrateArchive: boolean
) => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  })
  await client.login(discordBotToken)

  const newChannels: Channel[] = []
  for (const channel of channels) {
    if (!channel.slack.is_archived || migrateArchive) {
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
