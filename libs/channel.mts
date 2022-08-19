import { access, readFile, writeFile, mkdir, constants } from "node:fs/promises"
import { dirname, join } from "node:path"
import type { Channel as SlackBaseChannel } from "@slack/web-api/dist/response/ChannelsCreateResponse"
import { ChannelType, DiscordAPIError } from "discord.js"
import type { Guild as DiscordClientType } from "discord.js"
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
  slack: {
    channel_id: string
    channel_name: string
    is_archived: boolean
    purpose: string
    pin_ids: string[]
    message_file_paths: string[]
  }
  discord: {
    channel_id: string
    channel_name: string
    guild: {
      boost_level: 0 | 1 | 2 | 3
      boost_count: number
      max_file_size: 8000000 | 50000000 | 100000000
    }
    topic: string
    message_file_paths: string[]
  }
}

/**
 * Get channel file
 * @param distChannelFilePath
 */
export const getChannelFile = async (
  distChannelFilePath: string
): Promise<{
  channels: Channel[]
  status: "success" | "failed"
  message?: any
}> => {
  try {
    await access(distChannelFilePath, constants.R_OK)
    const channels = JSON.parse(
      await readFile(distChannelFilePath, "utf8")
    ) as Channel[]
    return { channels: channels, status: "success" }
  } catch (error) {
    return { channels: [], status: "failed", message: error }
  }
}

/**
 * Create channel file
 * @param distChannelFilePath
 * @param channels
 */
export const createChannelFile = async (
  distChannelFilePath: string,
  channels: Channel[]
): Promise<{
  status: "success" | "failed"
  message?: any
}> => {
  try {
    await mkdir(dirname(distChannelFilePath), {
      recursive: true,
    })
    await writeFile(distChannelFilePath, JSON.stringify(channels, null, 2))
    return { status: "success" }
  } catch (error) {
    return { status: "failed", message: error }
  }
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
): Promise<{
  status: "success" | "failed"
  message?: any
}> => {
  try {
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

    const newChannels = await Promise.all(
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
          slack: {
            channel_id: channel.id,
            channel_name: channel.name,
            is_archived: channel.is_archived,
            purpose: channel.purpose?.value || "",
            pin_ids: channel.pins?.map((pin) => pin.id) || [],
            message_file_paths: srcMessageFilePaths,
          },
          discord: {
            channel_id: "",
            channel_name: channel.name,
            guild: {
              boost_level: 0,
              boost_count: 0,
              max_file_size: 8000000,
            },
            topic: channel.purpose?.value || "",
            message_file_paths: distMessageFilePaths,
          },
        }

        return newChannel
      })
    )

    // チャンネルファイルを作成する
    const createChannelFileResult = await createChannelFile(
      distChannelFilePath,
      newChannels
    )
    if (createChannelFileResult.status === "failed") {
      return {
        status: "failed",
        message: createChannelFileResult.message,
      }
    }
    return { status: "success" }
  } catch (error) {
    return { status: "failed", message: error }
  }
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
): Promise<{
  channels: Channel[]
  status: "success" | "failed"
  message?: any
}> => {
  try {
    // チャンネルを作成する
    const newChannels = await Promise.all(
      channels.map(async (channel) => {
        const result = await discordClient.channels.create({
          name: channel.discord.channel_name,
          type: ChannelType.GuildText,
          topic: channel.discord.topic ? channel.discord.topic : undefined,
          parent: channel.slack.is_archived
            ? archiveCategory.id
            : defaultCategory.id,
        })

        // サーバーブーストレベルとファイルサイズを算出する
        const boostCount = result.guild.premiumSubscriptionCount || 0
        let boostLevel: Channel["discord"]["guild"]["boost_level"] = 0
        if (boostCount >= 2 && boostCount < 7) {
          boostLevel = 1
        } else if (boostCount >= 7 && boostCount < 14) {
          boostLevel = 2
        } else if (boostCount >= 14) {
          boostLevel = 3
        }
        let maxFileSize: Channel["discord"]["guild"]["max_file_size"] = 8000000
        if (boostLevel === 2) {
          maxFileSize = 50000000
        } else if (boostLevel === 3) {
          maxFileSize = 100000000
        }

        const newChannel = {
          ...channel,
          ...{
            discord: {
              channel_id: result.id,
              channel_name: channel.discord.channel_name,
              guild: {
                boost_level: boostLevel,
                boost_count: boostCount,
                max_file_size: maxFileSize,
              },
              topic: channel.discord.topic,
              message_file_paths: channel.discord.message_file_paths,
            },
          },
        }

        return newChannel
      })
    )

    // チャンネルファイルを更新する
    const createChannelFileResult = await createChannelFile(
      distChannelFilePath,
      newChannels
    )
    if (createChannelFileResult.status === "failed") {
      return {
        channels: [],
        status: "failed",
        message: createChannelFileResult.message,
      }
    }

    return { channels: newChannels, status: "success" }
  } catch (error) {
    return { channels: [], status: "failed", message: error }
  }
}

/**
 * Delete channel
 * @param discordClient
 * @param channels
 */
export const deleteChannel = async (
  discordClient: DiscordClientType,
  channels: Channel[]
): Promise<{
  status: "success" | "failed"
  message?: any
}> => {
  try {
    // チャンネルを削除する
    await Promise.all(
      channels.map(async (channel) => {
        try {
          await discordClient.channels.delete(channel.discord.channel_id)
        } catch (error) {
          if (error instanceof DiscordAPIError && error.code == 10003) {
            // 削除対象のチャンネルが存在しないエラーの場合は、何もしない
          } else {
            throw error
          }
        }
      })
    )

    return { status: "success" }
  } catch (error) {
    return { status: "failed", message: error }
  }
}
