import { readFile } from "node:fs/promises"
import { Message as SlackMessage } from "@slack/web-api/dist/response/ChatPostMessageResponse"
import { WebClient as Client } from "@slack/web-api"

export interface Bot {
  id: string
  app_id: string
  name: string
}

/**
 * Get bot id in message
 * @param slackMessageFilePath
 * @returns string[]
 */
export const getMessageBotIds = async (slackMessageFilePath: string) => {
  const slackMessageFile = await readFile(slackMessageFilePath, "utf8")
  const slackMessage: SlackMessage[] = JSON.parse(slackMessageFile)
  const botIds = slackMessage
    .filter((message) => message.bot_id)
    .map((message) => message.bot_id as string)

  return [...new Set(botIds)]
}

/**
 * Convert Bot
 * @param client
 * @param botIds
 * @returns Bot[]
 */
export const convertBots = async (client: Client, botIds: string[]) => {
  return await Promise.all(
    botIds.map(async (botId) => {
      const result = await client.bots.info({ bot: botId })
      return {
        id: result.bot?.id || "",
        app_id: result.bot?.app_id || "",
        name: result.bot?.name || "",
      } as Bot
    })
  )
}
