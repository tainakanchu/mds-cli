import { WebClient as SlackClient } from "@slack/web-api"
import { Client as DiscordClient, GatewayIntentBits } from "discord.js"
import type { Guild } from "discord.js"

/**
 * Create SlackClient
 * @param slackBotToken
 */
export const createSlackClient = (
  slackBotToken: string
): {
  slackClient?: SlackClient
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
 * Create DiscordGuild
 * @param discordBotToken: string
 * @param discordServerId: string
 */
export const createDiscordGuild = async (
  discordBotToken: string,
  discordServerId: string
): Promise<{
  discordGuild?: Guild
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
      return { discordGuild: guild, status: "success" }
    }
    return { status: "failed", message: "Guild is not found" }
  } catch (error) {
    return { status: "failed", message: error }
  }
}
