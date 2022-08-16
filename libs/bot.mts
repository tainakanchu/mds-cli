import { readFile } from "node:fs/promises"
import { Message as SlackMessage } from "@slack/web-api/dist/response/ChatPostMessageResponse"
import { WebClient as SlackClient } from "@slack/web-api"
import type { Channel } from "./channel.mjs"

export interface Bot {
  id: string
  app_id: string
  name: string
}

/**
 * Get bot data
 * @param slackClient
 * @param botIds
 */
export const getBotData = async (
  slackClient: SlackClient,
  botIds: string[]
): Promise<{
  bots: Bot[]
  status: "success" | "failed"
  message?: any
}> => {
  try {
    const bots = await Promise.all(
      botIds.map(async (botId) => {
        const result = await slackClient.bots.info({ bot: botId })
        return {
          id: result.bot?.id || "",
          app_id: result.bot?.app_id || "",
          name: result.bot?.name || "",
        } as Bot
      })
    )
    return { bots: bots, status: "success" }
  } catch (error) {
    return { bots: [], status: "success", message: error }
  }
}

/**
 * Get BotId in message
 * @param channels
 */
export const getMessageBotId = async (
  channels: Channel[]
): Promise<{
  botIds: string[]
  status: "success" | "failed"
  message?: any
}> => {
  let botIds: string[] = []

  try {
    for (const channel of channels) {
      for (const messageFilePath of channel.slack.message_file_paths) {
        const srcMessageFile = await readFile(messageFilePath, "utf8")
        const srcMessage: SlackMessage[] = JSON.parse(srcMessageFile)
        botIds = [
          ...botIds,
          ...srcMessage
            .filter((message) => message.bot_id)
            .map((message) => message.bot_id as string),
        ]
      }
    }
    // 重複は排除する
    botIds = [...new Set(botIds)]

    return { botIds: botIds, status: "success" }
  } catch (error) {
    return { botIds: [], status: "failed", message: error }
  }
}
