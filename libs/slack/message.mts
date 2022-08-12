import { access, readFile } from "node:fs/promises"
// BUG: @types/nodeにfsPromises.constantsが無いので代用
// https://github.com/nodejs/node/issues/44209
import { constants } from "node:fs"
import { Message } from "@slack/web-api/dist/response/ChatPostMessageResponse"
import type { SlackUser } from "./user.mjs"

export interface SlackMessage extends Message {
  type: string | "message"
  subtype?:
    | string
    | "bot_add"
    | "bot_message"
    | "bot_remove"
    | "channel_join"
    | "channel_topic"
    | "channel_archive"
    | "channel_purpose"
  text: string
  bot_id?: string
  timestamp: string
}

export const getSlackMessages = async (
  filePath: string,
  users: SlackUser[]
) => {
  await access(filePath, constants.R_OK)
  const messageFile = await readFile(filePath, "utf8")
  const messages: SlackMessage[] = JSON.parse(messageFile).map(
    (message: Message) => {
      let text = message.text ? message.text : ""

      // テキスト内のメンションをユーザー名もしくはBot名に置換する
      if (new RegExp(/<@U[A-Z0-9]{10}>/g).test(text)) {
        for (const user of users) {
          text = text.replaceAll(
            new RegExp(`<@${user.id}>`, "g"),
            `@${user.name}`
          )
        }
      }

      // TODO: 添付ファイルのダウンロード処理を書く
      return {
        type: message.type,
        subtype: message.subtype,
        text: text,
        bot_id: message.bot_id,
        timestamp: message.ts,
      } as SlackMessage
    }
  )
  return messages
}
