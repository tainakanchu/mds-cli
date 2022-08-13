import { access, readFile } from "node:fs/promises"
// BUG: @types/nodeにfsPromises.constantsが無いので代用
// https://github.com/nodejs/node/issues/44209
import { constants } from "node:fs"
import { fromUnixTime, format } from "date-fns"
import { Message as SlackMessage } from "@slack/web-api/dist/response/ChatPostMessageResponse"
import type { User } from "./user.mjs"

export interface Message {
  message_id: string
  text: string
  timestamp: string
}

export const getMessages = async (filePath: string, users: User[]) => {
  await access(filePath, constants.R_OK)
  const messageFile = await readFile(filePath, "utf8")
  const messages: SlackMessage[] = JSON.parse(messageFile).map(
    (message: SlackMessage) => {
      let text = message.text ? message.text : ""

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

      // テキストの最初に絵文字アイコンとユーザー名とタイムスタンプを追加
      const user = users.find((user) => user.slack.user_id === message.user)
      const userName = message.user && user ? user.discord.user_name : ""
      const icon = message.bot_id ? "🤖" : user?.slack.deleted ? "🥶" : "😃"
      const timestamp = message.ts
        ? format(fromUnixTime(Number(message.ts)), "yyyy/MM/dd HH:mm")
        : ""
      text = `${icon}  **${userName}**  ${timestamp}\n` + text

      // TODO: ここに添付ファイルのダウンロード処理を書く

      // TODO: ここにサブタイプに応じて必要なら処理を書く
      // "bot_add" | "bot_message" | "bot_remove" | "channel_join" | "channel_topic" | "channel_archive" | "channel_purpose"

      // チャットの区切りが見やすいように切り取り線をテキストの最後に追加
      // text += "\n------------------------------------------------"

      return {
        message_id: "",
        text: text,
        timestamp: "",
      } as Message
    }
  )
  return messages
}
