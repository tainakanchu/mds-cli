import { access, readFile, readdir, mkdir, writeFile } from "node:fs/promises"
import { statSync, constants } from "node:fs"
import { dirname, join } from "node:path"
import { fromUnixTime, format } from "date-fns"
import { Message as SlackMessage } from "@slack/web-api/dist/response/ChatPostMessageResponse"
import { ChannelType, Guild } from "discord.js"
import type { User } from "./user.mjs"
import type { Channel } from "./channel.mjs"

export interface Message {
  message_id: string
  text: string
  timestamp: string
}

/**
 * Build message file
 * @param srcMessageFilePath
 * @param distMessageFilePath
 * @param users
 * @param showCutLine
 */
export const buildMessageFile = async (
  srcMessageFilePath: string,
  distMessageFilePath: string,
  users: User[],
  showCutLine: boolean
): Promise<{
  messages: Message[]
  status: "success" | "failed"
  message?: any
}> => {
  const newMessages: Message[] = []
  try {
    await access(srcMessageFilePath, constants.R_OK)
    const messageFile = await readFile(srcMessageFilePath, "utf8")
    const messages = JSON.parse(messageFile) as SlackMessage[]
    for (const message of messages) {
      let text = ""

      // テキストの最初にチャットの区切りが見やすいように切り取り線を追加
      if (showCutLine)
        text += "------------------------------------------------\n"

      // テキストに絵文字アイコンとユーザー名とタイムスタンプを追加
      const user = users.find(
        (user) =>
          user.slack.id === message.user || user.slack.id === message.bot_id
      )

      const name = user ? user.discord.name : "NoName"
      const icon = message.bot_id ? "🤖" : user?.slack.deleted ? "🥶" : "😃"
      const timestamp = message.ts
        ? format(fromUnixTime(Number(message.ts)), "yyyy/MM/dd HH:mm")
        : ""
      text += `${icon}  **${name}**  ${timestamp}\n`

      // TODO: ここに添付ファイルのダウンロード処理を書く

      // TODO: ここにサブタイプに応じて必要なら処理を書く
      // "bot_add" | "bot_message" | "bot_remove" | "channel_join" | "channel_topic" | "channel_archive" | "channel_purpose"

      // テキストにメッセージ内容を追加
      text += message.text

      // テキスト内のメンションをユーザー名もしくはBot名に置換
      if (new RegExp(/<@U[A-Z0-9]{10}>/g).test(text)) {
        for (const user of users) {
          // Discordで送信時にメンションされないように加工
          text = text.replaceAll(
            new RegExp(`<@${user.slack.id}>`, "g"),
            `@${user.discord.name}`
          )
        }
      }

      newMessages.push({
        message_id: "",
        text: text,
        timestamp: "",
      })
    }

    await mkdir(dirname(distMessageFilePath), {
      recursive: true,
    })
    await writeFile(distMessageFilePath, JSON.stringify(newMessages, null, 2))

    return { messages: newMessages, status: "success" }
  } catch (error) {
    return { messages: [], status: "failed", message: error }
  }
}

/**
 * Build all message file
 * @param channels
 * @param users
 * @param showCutLine
 */
export const buildAllMessageFile = async (
  channels: Channel[],
  users: User[],
  showCutLine: boolean
): Promise<{
  status: "success" | "failed"
  message?: any
}> => {
  try {
    await Promise.all(
      channels.map(
        async (channel) =>
          await Promise.all(
            channel.slack.message_file_paths.map(
              async (srcMessageFilePath, index) => {
                const distMessageFilePath =
                  channel.discord.message_file_paths[index]
                const { status, message } = await buildMessageFile(
                  srcMessageFilePath,
                  distMessageFilePath,
                  users,
                  showCutLine
                )
                if (status === "failed") {
                  throw new Error(message)
                }
              }
            )
          )
      )
    )
    return { status: "success" }
  } catch (error) {
    return { status: "failed", message: error }
  }
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
 *  Create message
 * @param guild
 * @param channelId
 * @param messages
 */
export const createMessage = async (
  guild: Guild,
  channelId: string,
  messages: Message[]
) => {
  const channelGuild = guild?.channels.cache.get(channelId)
  const newMessages: Message[] = []
  if (channelGuild && channelGuild.type === ChannelType.GuildText) {
    for (const message of messages) {
      const result = await channelGuild.send(message.text)
      message.message_id = result.id
      newMessages.push(message)
    }
  }
  return newMessages
}
