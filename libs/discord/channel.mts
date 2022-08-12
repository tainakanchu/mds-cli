import { ChannelType, Client, GatewayIntentBits } from "discord.js"
import type { SlackChannel } from "../slack/channel.mjs"

export interface DiscordChannel {
  discord_channel_id?: string
  slack_channel_id: string
  name: string
  parent_id?: string
}

export const createDiscordChannels = async (
  discordToken: string,
  discordServerId: string,
  slackChannels: SlackChannel[],
  saveArchive: boolean
) => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  })
  await client.login(discordToken)

  let parentId: string | undefined = undefined
  if (saveArchive) {
    const result = await client.guilds.cache
      .get(discordServerId)
      ?.channels.create({
        name: "ARCHIVE",
        type: ChannelType.GuildCategory,
      })
    parentId = result?.id
  }

  const results = []
  for (const channel of slackChannels) {
    const result = await client.guilds.cache
      .get(discordServerId)
      ?.channels.create({
        name: channel.name,
        type: ChannelType.GuildText,
        parent: channel.is_archived ? parentId : undefined,
      })
    results.push({
      discord_channel_id: result?.id,
      slack_channel_id: channel.id,
      name: channel.name,
      parent_id: parentId,
    })
  }

  return results
}
