import { access, readFile, writeFile, mkdir, constants } from "node:fs/promises"
import { dirname, join } from "node:path"
import type { Channel as SlackBaseChannel } from "@slack/web-api/dist/response/ChannelsCreateResponse"
import { ChannelType, DiscordAPIError } from "discord.js"
import type { Guild as DiscordClientType } from "discord.js"
import retry from "async-retry"
import type { Category } from "./category.mjs"
import { getMessageFilePaths } from "./message.mjs"

interface SlackChannel extends SlackBaseChannel {
  pins?: {
    id: string
    type: "C"
    created: number
    user: string
    owner: string
  }[]
}

export interface Channel {
  id: string
  name: string
  type: "default" | "user_image_host"
  guild: {
    boost_level: 0 | 1 | 2 | 3
    boost_count: number
    max_file_size: 8000000 | 50000000 | 100000000
  }
  topic: string
  message_file_paths: string[]
  src: {
    id: string
    name: string
    is_archived: boolean
    purpose: string
    pin_ids: string[]
    message_file_paths: string[]
  }
}

/**
 * Get channel file
 * @param distChannelFilePath
 */
export const getChannelFile = async (
  distChannelFilePath: string
): Promise<Channel[]> => {
  await access(distChannelFilePath, constants.R_OK)
  const channels = JSON.parse(
    await readFile(distChannelFilePath, "utf8")
  ) as Channel[]
  return channels
}

/**
 * Create channel file
 * @param distChannelFilePath
 * @param channels
 */
export const createChannelFile = async (
  distChannelFilePath: string,
  channels: Channel[]
): Promise<void> => {
  await mkdir(dirname(distChannelFilePath), {
    recursive: true,
  })
  await writeFile(distChannelFilePath, JSON.stringify(channels, null, 2))
}

/**
 * Build channel file
 * @param srcChannelFilePath
 * @param distChannelFilePath
 * @param srcMessageDirPath
 * @param distMessageDirPath
 * @param migrateArchive
 */
export const buildChannelFile = async (
  srcChannelFilePath: string,
  distChannelFilePath: string,
  srcMessageDirPath: string,
  distMessageDirPath: string,
  migrateArchive: boolean
): Promise<void> => {
  await access(srcChannelFilePath, constants.R_OK)
  let slackChannels = JSON.parse(
    await readFile(srcChannelFilePath, "utf8")
  ) as SlackChannel[]

  // アーカイブチャンネルを含めない場合は除外する
  if (!migrateArchive) {
    slackChannels = slackChannels.filter(
      (channel) => channel.is_archived === false
    )
  }

  const newChannels = await retry(
    async () =>
      await Promise.all(
        slackChannels.map(async (channel) => {
          // チャンネルの必須項目がない場合は例外を投げる
          if (channel.name === undefined) {
            throw new Error("Channel is missing a required parameter")
          }

          // Slackのメッセージファイルのパスを取得する
          const srcMessageFilePaths = await getMessageFilePaths(
            join(srcMessageDirPath, channel.name)
          )

          // Discordのメッセージファイルのパスを算出する
          const distMessageFilePaths = srcMessageFilePaths.map(
            (messageFilePath) =>
              messageFilePath.replace(srcMessageDirPath, distMessageDirPath)
          )

          // チャンネルの必須項目がない場合は例外を投げる
          if (channel.id === undefined || channel.is_archived === undefined) {
            throw new Error("Channel is missing a required parameter")
          }

          const newChannel: Channel = {
            id: "",
            name: channel.name,
            type: "default",
            guild: {
              boost_level: 0,
              boost_count: 0,
              max_file_size: 8000000,
            },
            topic: channel.purpose?.value || "",
            message_file_paths: distMessageFilePaths,
            src: {
              id: channel.id,
              name: channel.name,
              is_archived: channel.is_archived,
              purpose: channel.purpose?.value || "",
              pin_ids: channel.pins?.map((pin) => pin.id) || [],
              message_file_paths: srcMessageFilePaths,
            },
          }

          return newChannel
        })
      )
  )

  // チャンネルファイルを作成する
  await createChannelFile(distChannelFilePath, newChannels)
}

/**
 * Deploy channel
 * @param discordClient
 * @param channels
 * @param distChannelFilePath
 * @param defaultCategory
 * @param archiveCategory
 */
export const deployChannel = async (
  discordClient: DiscordClientType,
  channels: Channel[],
  distChannelFilePath: string,
  defaultCategory: Category,
  archiveCategory: Category
): Promise<Channel[]> => {
  // チャンネルを作成する
  const newChannels = await Promise.all(
    channels
      // ユーザーの画像をホストしているチャンネルの作成は除外する
      .filter((channel) => channel.type === "default")
      .map(async (channel) => {
        const newChannel = await retry(
          async () =>
            await discordClient.channels.create({
              name: channel.name,
              type: ChannelType.GuildText,
              topic: channel.topic ? channel.topic : undefined,
              parent: channel.src.is_archived
                ? archiveCategory.id
                : defaultCategory.id,
            })
        )

        // サーバーブーストレベルとファイルサイズを算出する
        const boostCount = newChannel.guild.premiumSubscriptionCount || 0
        let boostLevel: Channel["guild"]["boost_level"] = 0
        if (boostCount >= 2 && boostCount < 7) {
          boostLevel = 1
        } else if (boostCount >= 7 && boostCount < 14) {
          boostLevel = 2
        } else if (boostCount >= 14) {
          boostLevel = 3
        }
        let maxFileSize: Channel["guild"]["max_file_size"] = 8000000
        if (boostLevel === 2) {
          maxFileSize = 50000000
        } else if (boostLevel === 3) {
          maxFileSize = 100000000
        }

        return {
          ...channel,
          ...({
            id: newChannel.id,
            name: channel.name,
            type: "default",
            guild: {
              boost_level: boostLevel,
              boost_count: boostCount,
              max_file_size: maxFileSize,
            },
            topic: channel.topic,
            message_file_paths: channel.message_file_paths,
          } as Channel),
        }
      })
  )

  // チャンネルファイルを更新する
  await createChannelFile(distChannelFilePath, newChannels)

  return newChannels
}

/**
 * Delete channel
 * @param discordClient
 * @param channels
 */
export const deleteChannel = async (
  discordClient: DiscordClientType,
  channels: Channel[]
): Promise<void> => {
  await Promise.all(
    channels.map(async (channel) => {
      try {
        await retry(async () => {
          await discordClient.channels.delete(channel.id)
        })
      } catch (error) {
        if (error instanceof DiscordAPIError && error.code == 10003) {
          // 削除対象のチャンネルが存在しないエラーの場合は、何もしない
        } else {
          throw error
        }
      }
    })
  )
}
