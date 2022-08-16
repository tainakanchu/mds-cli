import { access, readFile, writeFile, mkdir, constants } from "node:fs/promises"
import { dirname, join } from "node:path"
import { Channel as SlackChannel } from "@slack/web-api/dist/response/ChannelsCreateResponse"
import { ChannelType } from "discord.js"
import type { Guild } from "discord.js"
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
    is_archived: boolean
    is_deleted: boolean
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
 */
export const buildChannelFile = async (
  srcChannelFilePath: string,
  distChannelFilePath: string,
  srcMessageDirPath: string,
  distMessageDirPath: string
): Promise<{
  channels: Channel[]
  status: "success" | "failed"
  message?: any
}> => {
  const newChannels: Channel[] = []
  try {
    await access(srcChannelFilePath, constants.R_OK)
    const slackChannels = JSON.parse(
      await readFile(srcChannelFilePath, "utf8")
    ) as SlackChannel[]

    for (const channel of slackChannels) {
      if (channel.name) {
        // Slackのメッセージファイルのパスを取得する
        const srcMessageFilePaths = await getMessageFilePaths(
          join(srcMessageDirPath, channel.name)
        )

        // Discordのメッセージファイルのパスを算出する
        const distMessageFilePaths = srcMessageFilePaths.map(
          (messageFilePath) =>
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
            is_archived: channel.is_archived || false,
            is_deleted: false,
            topic: channel.purpose?.value ? channel.purpose.value : "",
            message_file_paths: distMessageFilePaths,
          },
        })
      }
    }

    const createChannelFileResult = await createChannelFile(
      distChannelFilePath,
      newChannels
    )
    if (createChannelFileResult.status === "failed") {
      return {
        channels: newChannels,
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
 * Create channel
 * @param discordGuild
 * @param channels
 * @param distChannelFilePath
 * @param defaultCategory
 * @param archiveCategory
 * @param migrateArchive
 */
export const createChannel = async (
  discordGuild: Guild,
  channels: Channel[],
  distChannelFilePath: string,
  defaultCategory: Category,
  archiveCategory: Category,
  migrateArchive: boolean
): Promise<{
  channels: Channel[]
  status: "success" | "failed"
  message?: any
}> => {
  try {
    // チャンネルを作成する
    const newChannels: Channel[] = []
    for (const channel of channels) {
      if (!channel.discord.is_archived || migrateArchive) {
        const result = await discordGuild.channels.create({
          name: channel.discord.channel_name,
          type: ChannelType.GuildText,
          topic: channel.discord.topic ? channel.discord.topic : undefined,
          parent: channel.discord.is_archived
            ? archiveCategory.id
            : defaultCategory.id,
        })
        // チャンネルのIDを更新する
        channel.discord.channel_id = result.id
        newChannels.push(channel)
      }
    }

    // チャンネルファイルを作成する
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
 * @param discordGuild
 * @param channels
 * @param distChannelFilePath
 */
export const deleteChannel = async (
  discordGuild: Guild,
  channels: Channel[],
  distChannelFilePath: string
): Promise<{
  channels: Channel[]
  status: "success" | "failed"
  message?: any
}> => {
  try {
    // チャンネルを削除する
    const newChannels: Channel[] = []
    for (const channel of channels) {
      await discordGuild.channels.delete(channel.discord.channel_id)
      channel.discord.is_deleted = true
      newChannels.push(channel)
    }

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
