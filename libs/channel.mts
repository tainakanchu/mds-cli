import { access, readFile, writeFile, mkdir, constants } from "node:fs/promises"
import { dirname, join } from "node:path"
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
 * Get channel file
 * @param distChannelFilePath
 * @returns Channel[]
 */
export const getChannelFile = async (distChannelFilePath: string) => {
  await access(distChannelFilePath, constants.R_OK)
  return JSON.parse(await readFile(distChannelFilePath, "utf8")) as Channel[]
}

/**
 * Create channel file
 * @param distChannelFilePath
 * @param channels
 */
export const createChannelFile = async (
  distChannelFilePath: string,
  channels: Channel[]
) => {
  await mkdir(dirname(distChannelFilePath), {
    recursive: true,
  })
  await writeFile(distChannelFilePath, JSON.stringify(channels, null, 2))
}

/**
 *  * Build channel file
 * @param srcChannelFilePath
 * @param distChannelFilePath
 * @param srcMessageDirPath
 * @param distMessageDirPath
 * @returns Channel[]
 */
export const buildChannelFile = async (
  srcChannelFilePath: string,
  distChannelFilePath: string,
  srcMessageDirPath: string,
  distMessageDirPath: string
) => {
  await access(srcChannelFilePath, constants.R_OK)
  const slackChannels = JSON.parse(
    await readFile(srcChannelFilePath, "utf8")
  ) as SlackChannel[]

  const channels: Channel[] = []
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

      channels.push({
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

  await mkdir(dirname(distChannelFilePath), {
    recursive: true,
  })
  await writeFile(distChannelFilePath, JSON.stringify(channels, null, 2))

  return channels
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
export const createChannel = async (
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
export const deleteChannel = async (
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
