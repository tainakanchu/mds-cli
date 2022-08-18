import { WebClient as SlackClient } from "@slack/web-api"
import type { WebClient as SlackClientType } from "@slack/web-api"
import { Client as DiscordClient, GatewayIntentBits } from "discord.js"
import type { Guild as DiscordClientType } from "discord.js"

/**
 * Create slack client
 * @param slackBotToken
 */
export const createSlackClient = (
  slackBotToken: string
): {
  slackClient?: SlackClientType
  status: "success" | "failed"
  message?: any
} => {
  try {
    return { slackClient: new SlackClient(slackBotToken), status: "success" }
  } catch (error) {
    return { status: "failed", message: error }
  }
}

/**
 * Create discord client
 * @param discordBotToken: string
 * @param discordServerId: string
 */
export const createDiscordClient = async (
  discordBotToken: string,
  discordServerId: string
): Promise<{
  discordClient?: DiscordClientType
  status: "success" | "failed"
  message?: any
}> => {
  try {
    const client = new DiscordClient({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    })
    await client.login(discordBotToken)
    const guild = client.guilds.cache.get(discordServerId)
    if (guild) {
      return { discordClient: guild, status: "success" }
    }
    return { status: "failed", message: "Guild is not found" }
  } catch (error) {
    return { status: "failed", message: error }
  }
}
