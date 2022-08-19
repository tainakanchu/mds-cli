import { access, readFile, readdir, mkdir, writeFile } from "node:fs/promises"
import { statSync, constants } from "node:fs"
import { dirname, join } from "node:path"
import { format, formatISO, fromUnixTime } from "date-fns"
import {
  Message as SlackBaseMessage,
  FileElement,
} from "@slack/web-api/dist/response/ChatPostMessageResponse"
import { ChannelType, EmbedType, DiscordAPIError } from "discord.js"
import type {
  Guild as DiscordClientType,
  APIEmbed as Embed,
  TextChannel,
} from "discord.js"
import type { WebClient as SlackClientType } from "@slack/web-api"
import { getUser, getUsername } from "./user.mjs"
import type { User } from "./user.mjs"
import type { Channel } from "./channel.mjs"

export interface SlackMessage extends SlackBaseMessage {
  files?: FileElement[]
}

export interface Message {
  id?: string
  type: "default" | "pin_message"
  channel_id?: string
  guild_id?: string
  content?: string
  embeds?: Embed[]
  files?: string[]
  anthor?: {
    id: string
    name: string
    type: "bot"
  }
  timestamp?: number
  is_pinned: boolean
  slack: {
    anthor: {
      id: string
      name: string
      type: "bot" | "active-user" | "cancel-user"
      type_icon: "🟢" | "🔵" | "🤖"
      image_url: string
      color: string | "808080"
    }
    timestamp: string
  }
}

/**
 * Get message file
 * @param distMessageFilePath
 */
export const getMessageFile = async (
  distMessageFilePath: string
): Promise<Message[]> => {
  await access(distMessageFilePath, constants.R_OK)
  const messages = JSON.parse(
    await readFile(distMessageFilePath, "utf8")
  ) as Message[]
  return messages
}

/**
 * Create message file
 * @param distMessageFilePath
 * @param messages
 */
export const createMessageFile = async (
  distMessageFilePath: string,
  messages: Message[]
): Promise<void> => {
  await mkdir(dirname(distMessageFilePath), {
    recursive: true,
  })
  await writeFile(distMessageFilePath, JSON.stringify(messages, null, 2))
}

/**
 * Build message file
 * @param srcMessageFilePath
 * @param distMessageFilePath
 * @param users
 */
export const buildMessageFile = async (
  slackClient: SlackClientType,
  srcMessageFilePath: string,
  distMessageFilePath: string,
  users: User[],
  pinIds: string[],
  maxFileSize: number
): Promise<{
  isMaxFileSizeOver?: boolean
}> => {
  await access(srcMessageFilePath, constants.R_OK)
  const messageFile = await readFile(srcMessageFilePath, "utf8")
  const messages = JSON.parse(messageFile) as SlackMessage[]
  let isMaxFileSizeOver = false

  const newMessages: Message[] = []
  for (const message of messages) {
    // メッセージの必須項目がない場合は例外を投げる
    if (message.text === undefined || message.ts === undefined) {
      throw new Error("Message is missing a required parameter")
    }

    let content = message.text

    // メッセージ内のユーザー名もしくはBot名のメンションを、Discordでメンションされない形式に置換
    const matchMention = content.match(/<@U[A-Z0-9]{10}>/g)
    if (matchMention?.length) {
      const userIds = matchMention.map((mention) =>
        mention.replace(/<@|>/g, "")
      )
      for (const userId of userIds) {
        const user = users.find((user) => user.slack.id === userId)
        if (user && user.slack.name) {
          content = content.replaceAll(`<@${userId}>`, `@${user.slack.name}`)
        } else {
          // usersにないメンションは、APIから取得する
          const username = await getUsername(slackClient, userId)
          if (username) {
            content = content.replaceAll(`<@${userId}>`, `@${username}`)
          } else {
            throw new Error(
              `Failed to convert mention of @${userId} to username\n`
            )
          }
        }
      }
    }

    // メッセージ内のチャンネルメンションタグを、Discordで表示される形式に置換
    if (/<!channel>/.test(content))
      content = content.replaceAll(/<!channel>/g, "@channel")

    // メッセージ内の太文字を、Discordで表示される形式に置換
    if (/\*.*\*/.test(content)) content = content.replaceAll(/\**\*/g, "**")

    // メッセージ内の斜体文字を、Discordで表示される形式に置換
    // if (/\_.*\_/.test(content)) content = content.replaceAll(/\_*\_/g, "_")

    // メッセージ内の打ち消し線を、Discordで表示される形式に置換
    if (/~.*~/.test(content)) content = content.replaceAll(/~*~/g, "~~")

    // メッセージ内の引用タグを、Discordで表示される形式に置換
    if (/&gt; .*/.test(content)) content = content.replaceAll(/&gt; /g, "> ")

    // メッセージ内のURLタグを、Discordで表示される形式に置換
    if (/<http|https:\/\/.*\|.*>/.test(content))
      content = content.replaceAll(/<|\|.*>/g, "")

    // 埋め込みフィールドを作成
    const fields: Embed["fields"] = [
      {
        name: "------------------------------------------------",
        value: content,
      },
    ]

    // メッセージの送信者情報を取得
    let user = users.find(
      (user) =>
        user.slack.id === message.user ||
        user.slack.bot?.app_id === message.app_id
    )
    // メッセージの送信者情報が取得できない場合は、APIから取得
    if (!user) {
      if (message.user) user = await getUser(slackClient, message.user)
      if (!user) throw new Error("Failed to get user for message")
    }
    const anthor: Message["slack"]["anthor"] = {
      id: user.slack.id,
      name: user.slack.name,
      type: message.bot_id
        ? "bot"
        : user.slack.is_deleted
        ? "cancel-user"
        : "active-user",
      color: user.slack.color,
      type_icon: message.bot_id ? "🤖" : user.slack.is_deleted ? "🔵" : "🟢",
      image_url: user.slack.image_url,
    }

    // メッセージの投稿日時を算出
    const postTime = format(fromUnixTime(Number(message.ts)), " HH:mm")
    const isoPostDatetime = formatISO(fromUnixTime(Number(message.ts)))

    // メッセージがピン留めアイテムか判別
    const isPinned = pinIds.includes(message.ts) ? true : false

    newMessages.push({
      type: "default",
      content: content,
      embeds: [
        {
          type: EmbedType.Rich,
          color: parseInt(anthor.color, 16),
          fields: fields,
          timestamp: isoPostDatetime,
          author: {
            name: `${anthor.type_icon} ${anthor.name}    ${postTime}`,
            icon_url: anthor.image_url,
          },
        },
      ],
      is_pinned: isPinned,
      slack: {
        anthor: anthor,
        timestamp: message.ts,
      },
    })

    // Discordにアップロードできる最大ファイルサイズを超過したファイルは、ファイルをアップロードせず、ファイルURLを添付する
    const sizeOverFileUrls = message.files
      ?.filter((file) => file.size && file.size >= maxFileSize)
      .map((file) => file.url_private || "")
    const uploadFileUrls = message.files
      ?.filter((file) => file.size && file.size < maxFileSize)
      .map((file) => file.url_private || "")
    if (sizeOverFileUrls || uploadFileUrls) {
      // 埋め込みの下に添付ファイルが表示されるように、添付ファイルは別メッセージにする
      newMessages.push({
        type: "default",
        content: sizeOverFileUrls ? sizeOverFileUrls?.join("\n") : "",
        files: uploadFileUrls?.length ? uploadFileUrls : undefined,
        is_pinned: isPinned,
        slack: {
          anthor: anthor,
          timestamp: message.ts,
        },
      })
    }
  }

  // メッセージファイルを作成
  await createMessageFile(distMessageFilePath, newMessages)

  return { isMaxFileSizeOver: isMaxFileSizeOver }
}

/**
 * Build all message file
 * @param channels
 * @param users
 */
export const buildAllMessageFile = async (
  slackClient: SlackClientType,
  channels: Channel[],
  users: User[]
): Promise<{
  isMaxFileSizeOver?: boolean
}> => {
  let isMaxFileSizeOver = false
  await Promise.all(
    channels.map(
      async (channel) =>
        await Promise.all(
          channel.slack.message_file_paths.map(
            async (srcMessageFilePath, index) => {
              const distMessageFilePath =
                channel.discord.message_file_paths[index]
              const buildMessageFileResult = await buildMessageFile(
                slackClient,
                srcMessageFilePath,
                distMessageFilePath,
                users,
                channel.slack.pin_ids,
                channel.discord.guild.max_file_size
              )
              if (
                buildMessageFileResult.isMaxFileSizeOver &&
                !isMaxFileSizeOver
              ) {
                isMaxFileSizeOver = true
              }
            }
          )
        )
    )
  )
  return { isMaxFileSizeOver: isMaxFileSizeOver }
}

/**
 * Get message directory path
 * @param messageDirPath
 */
export const getMessageFilePaths = async (messageDirPath: string) => {
  const fileOrDirNames = await readdir(join(messageDirPath))
  const messageFilePaths = fileOrDirNames
    .filter(
      (fileOrDirName) =>
        // TODO: 非同期関数に置換する
        statSync(join(messageDirPath, fileOrDirName)).isFile() &&
        new RegExp(
          /[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]).json/g
        ).test(fileOrDirName)
    )
    .map((fileOrDirName) => join(messageDirPath, fileOrDirName))
  return messageFilePaths
}

/**
 * Deploy message
 * @param channelGuild
 * @param distMessageFilePath
 * @param messages
 */
export const deployMessage = async (
  channelGuild: TextChannel,
  messages: Message[],
  distMessageFilePath: string
): Promise<{
  messages: Message[]
  isMaxFileSizeOver?: boolean
}> => {
  // 時系列順にメッセージを作成するため、メッセージ作成処理は直列処理で実行
  const newMessages: Message[] = []
  let isMaxFileSizeOver = false
  for (const message of messages) {
    const sendMessage = await channelGuild.send({
      content: message.embeds ? undefined : message.content,
      files: message.files,
      embeds: message.embeds,
    })

    // メッセージの送信結果が取得できない場合は、例外を投げる
    if (!sendMessage || !sendMessage.guildId) {
      throw new Error("Failed to get deploy message result")
    }

    // システムメッセージはメッセージを作成しないように除外する
    if (message.type !== "default") continue

    newMessages.push({
      ...message,
      ...{
        id: sendMessage.id,
        channel_id: sendMessage.channelId,
        guild_id: sendMessage.guildId,
        timestamp: sendMessage.createdTimestamp,
        anthor: {
          id: sendMessage.author.id,
          name: sendMessage.author.username,
          type: "bot",
        },
      },
    })

    // ピン留めアイテムの場合は、ピン留めする
    if (message.is_pinned) {
      const pinMessage = await sendMessage.pin()
      if (!pinMessage || !pinMessage.guildId) {
        throw new Error("Failed to pin message")
      }

      // ピン留めアイテムの追加メッセージを追加
      newMessages.push({
        ...message,
        ...{
          id: pinMessage.id,
          types: "pin_message",
          channel_id: pinMessage.channelId,
          guild_id: pinMessage.guildId,
          timestamp: pinMessage.createdTimestamp,
          anthor: {
            id: pinMessage.author.id,
            name: pinMessage.author.username,
            type: "bot",
          },
          is_pinned: false,
        },
      })
    }
  }

  // メッセージファイルを更新
  await createMessageFile(distMessageFilePath, newMessages)

  return {
    messages: newMessages,
    isMaxFileSizeOver: isMaxFileSizeOver,
  }
}

/**
 * Deploy all message
 */
export const deployAllMessage = async (
  discordClient: DiscordClientType,
  channels: Channel[]
): Promise<{
  isMaxFileSizeOver?: boolean
}> => {
  let isMaxFileSizeOver = false
  await Promise.all(
    channels.map(async (channel) => {
      // チャンネルギルドを作成
      const channelGuild = discordClient.channels.cache.get(
        channel.discord.channel_id
      )
      if (
        channelGuild === undefined ||
        channelGuild.type !== ChannelType.GuildText
      ) {
        throw new Error("Failed to get channel guild")
      }

      for (const messageFilePath of channel.discord.message_file_paths) {
        const messages = await getMessageFile(messageFilePath)
        const deployMessageResult = await deployMessage(
          channelGuild,
          messages,
          messageFilePath
        )
        if (deployMessageResult.isMaxFileSizeOver && !isMaxFileSizeOver) {
          isMaxFileSizeOver = true
        }
      }
    })
  )
  return { isMaxFileSizeOver: isMaxFileSizeOver }
}

/**
 *  Delete message
 * @param channelGuild
 * @param messages
 */
export const deleteMessage = async (
  channelGuild: TextChannel,
  messages: Message[]
): Promise<void> => {
  await Promise.all(
    messages.map(async (message) => {
      // メッセージの必須項目がない場合は例外を投げる
      if (message.id === undefined)
        throw new Error("Message is missing a required parameter")

      try {
        // ピン留めアイテムの場合は、ピン留めを解除する
        if (message.is_pinned) {
          await channelGuild.messages.unpin(message.id)
        }
        await channelGuild.messages.delete(message.id)
      } catch (error) {
        if (error instanceof DiscordAPIError && error.code === 10008) {
          // 削除対象のメッセージが存在しないエラーの場合は、何もしない
        } else {
          throw error
        }
      }
    })
  )
}

/**
 * Delete all message
 */
export const deleteAllMessage = async (
  discordClient: DiscordClientType,
  channels: Channel[]
): Promise<void> => {
  await Promise.all(
    channels.map(async (channel) => {
      // チャンネルギルドを作成
      const channelGuild = discordClient.channels.cache.get(
        channel.discord.channel_id
      )
      if (
        channelGuild === undefined ||
        channelGuild.type !== ChannelType.GuildText
      ) {
        throw new Error("Failed to get channel guild")
      }

      await Promise.all(
        channel.discord.message_file_paths.map(async (messageFilePath) => {
          const messages = await getMessageFile(messageFilePath)
          await deleteMessage(channelGuild, messages)
        })
      )
    })
  )
}
