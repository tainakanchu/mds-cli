import { access, readFile, readdir } from "node:fs/promises"
import { statSync, constants } from "node:fs"
import { join } from "node:path"
import { fromUnixTime, format } from "date-fns"
import { Message as SlackMessage } from "@slack/web-api/dist/response/ChatPostMessageResponse"
import { ChannelType, Guild } from "discord.js"
import type { User } from "./user.mjs"

export interface Message {
  message_id: string
  text: string
  timestamp: string
}

/**
 * Get message infomation
 * @param filePath
 * @param users
 * @returns Message[]
 */
export const getMessages = async (filePath: string, users: User[]) => {
  await access(filePath, constants.R_OK)
  const messageFile = await readFile(filePath, "utf8")
  const messages: SlackMessage[] = JSON.parse(messageFile).map(
    (message: SlackMessage) => {
      // テキストの最初にチャットの区切りが見やすいように切り取り線を追加
      let text = "------------------------------------------------\n"

      // テキストに絵文字アイコンとユーザー名とタイムスタンプを追加
      const user = users.find((user) => user.slack.user_id === message.user)
      const userName = message.user && user ? user.discord.user_name : ""
      const icon = message.bot_id ? "🤖" : user?.slack.deleted ? "🥶" : "😃"
      const timestamp = message.ts
        ? format(fromUnixTime(Number(message.ts)), "yyyy/MM/dd HH:mm")
        : ""
      text += `${icon}  **${userName}**  ${timestamp}\n`

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
            new RegExp(`<@${user.slack.user_id}>`, "g"),
            `@${user.discord.user_name}`
          )
        }
      }

      return {
        message_id: "",
        text: text,
        timestamp: "",
      } as Message
    }
  )
  return messages
}

/**
 * Get message directory path
 * @param messageDirPath
 * @returns string[]
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
 * @returns Message[]
 */
export const createMessages = async (
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
