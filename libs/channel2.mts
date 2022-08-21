import { PrismaClient, SlackChannel, DiscordChannel } from "@prisma/client"
import { access, readFile, constants } from "node:fs/promises"
import { ChannelType } from "discord.js"
import type { Guild as DiscordClient } from "discord.js"
import retry from "async-retry"
import { CategoryClient } from "./category2.mjs"

interface SlackChannelFile {
  id?: string
  name?: string
  purpose?: string
  topic?: {
    value: string
  }
  is_archived?: boolean
  pins?: {
    id: string
    user: string
  }[]
}

export class ChannelClient {
  client: PrismaClient
  constructor(client = new PrismaClient()) {
    this.client = client
  }

  /**
   * Migrate channel
   * @param channelFilePath
   */
  async migrateChannel(channelFilePath: string) {
    // Get channel file
    const channels = await this.getSlackChannelFile(channelFilePath)

    // Convert channel
    const newChannels: SlackChannel[] = channels.map((channel) => {
      if (
        channel.id === undefined ||
        channel.name === undefined ||
        channel.topic === undefined ||
        channel.is_archived === undefined
      )
        throw new Error("Channel is missing a required parameter")

      return {
        id: 0,
        channelId: channel.id,
        name: channel.name,
        type: 1,
        topic: channel.topic.value,
        isArchived: channel.is_archived,
        pins: channel.pins?.map((pin) => pin.id).join(",") || null,
      }
    })

    // Update channel
    await this.updateSlackChannelMany(newChannels)
  }

  /**
   * Deploy channel
   */
  async deployChannel(discordClient: DiscordClient, channels: SlackChannel[]) {
    // Deploy category
    const categoryClient = new CategoryClient(this.client)
    const categories = await categoryClient.deployCategory(discordClient, [
      "CHANNEL",
      "ARCHIVE",
    ])
    const defaultCategory = categories[0]
    const archiveCategory = categories[1]

    // Deploy channel
    const newChannels: DiscordChannel[] = await Promise.all(
      channels.map(async (channel) => {
        const categoryId = channel.isArchived
          ? archiveCategory.categoryId
          : defaultCategory.categoryId

        const result = await retry(
          async () =>
            await discordClient.channels.create({
              name: channel.name,
              type: ChannelType.GuildText,
              topic: channel.topic ? channel.topic : undefined,
              parent: categoryId,
            })
        )

        return {
          id: 0,
          name: result.name,
          channelId: result.id,
          categoryId: categoryId,
          slackChannelId: channel.channelId,
          topic: result.topic,
          isArchived: channel.isArchived,
        }
      })
    )

    // Update channel data
    await this.updateDiscordChannelMany(newChannels)

    return newChannels
  }

  /**
   * Get slack channel
   */
  async getSlackChannelMany() {
    return await this.client.slackChannel.findMany()
  }

  /**
   * Get slack channel file
   * @param channelFilePath
   */
  async getSlackChannelFile(channelFilePath: string) {
    await access(channelFilePath, constants.R_OK)
    const channels = JSON.parse(
      await readFile(channelFilePath, "utf8")
    ) as SlackChannelFile[]
    return channels
  }

  /**
   * Update many slack channel
   * @param channels
   */
  async updateSlackChannelMany(channels: SlackChannel[]) {
    const query = channels.map((channel) =>
      this.client.slackChannel.upsert({
        where: {
          channelId: channel.channelId,
        },
        update: {
          name: channel.name,
          type: channel.type,
          topic: channel.topic,
          isArchived: channel.isArchived,
          pins: channel.pins,
        },
        create: {
          channelId: channel.channelId,
          name: channel.name,
          type: channel.type,
          topic: channel.topic,
          isArchived: channel.isArchived,
          pins: channel.pins,
        },
      })
    )
    await this.client.$transaction([...query])
  }

  /**
   * Update many discord channel
   * @param channels
   */
  async updateDiscordChannelMany(channels: DiscordChannel[]) {
    const query = channels.map((channel) =>
      this.client.discordChannel.upsert({
        where: {
          channelId: channel.channelId,
        },
        update: {
          name: channel.name,
          channelId: channel.channelId,
          categoryId: channel.categoryId,
          slackChannelId: channel.slackChannelId,
          topic: channel.topic,
          isArchived: channel.isArchived,
        },
        create: {
          name: channel.name,
          channelId: channel.channelId,
          categoryId: channel.categoryId,
          slackChannelId: channel.slackChannelId,
          topic: channel.topic,
          isArchived: channel.isArchived,
        },
      })
    )
    await this.client.$transaction([...query])
  }

  // async connect(): Promise<void> {
  //   await this.client.$connect()
  // }

  // async disconnect(): Promise<void> {
  //   await this.client.$disconnect()
  // }
}
