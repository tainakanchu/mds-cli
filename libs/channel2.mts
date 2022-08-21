import { PrismaClient, SlackChannel, DiscordChannel } from "@prisma/client"
import { access, readFile, constants } from "node:fs/promises"
import { ChannelType, DiscordAPIError } from "discord.js"
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
   * Migrate channel data
   * @param channelFilePath
   */
  async migrateChannel(channelFilePath: string) {
    // Get slack channel file
    const slackChannels = await this.getSlackChannelFile(channelFilePath)

    // Convert slack channel data
    const newSlackChannels: SlackChannel[] = slackChannels.map((channel) => {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })

    // Update slack channel data
    await this.updateManySlackChannel(newSlackChannels)
  }

  /**
   * Deploy single discord channel
   * @param discordClient
   * @param channelName
   * @param channelType
   * @param slackChannelId
   * @param option
   */
  async deployDiscordChannel(
    discordClient: DiscordClient,
    channelName: string,
    slackChannelId: string,
    option: {
      channelType: 1 | 2
      topic?: string
      isArchived: boolean
    } = { channelType: 1, isArchived: false }
  ) {
    // Get discord category id
    const categoryClient = new CategoryClient(this.client)
    const category = option.isArchived
      ? await categoryClient.getDiscordCategory("ARCHIVE")
      : await categoryClient.getDiscordCategory("CHANNEL")
    if (!category) throw new Error("Failed to get category")

    // Deploy discord channel
    const result = await retry(
      async () =>
        await discordClient.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          topic: option.topic,
          parent: category.categoryId,
        })
    )

    const discordChannel: DiscordChannel = {
      id: 0,
      name: result.name,
      channelId: result.id,
      categoryId: category.categoryId,
      slackChannelId: slackChannelId,
      type: option.channelType,
      topic: result.topic || null,
      isArchived: option.isArchived,
      createdAt: result.createdAt,
      updatedAt: result.createdAt,
    }

    // Update discord channel data
    await this.updateDiscordChannel(discordChannel)

    return result
  }

  /**
   * Deploy all discord channel
   */
  async deployAllDiscordChannel(discordClient: DiscordClient) {
    // Get all slack channel data
    const slackChannels = await this.client.slackChannel.findMany({
      where: {
        type: {
          equals: 1,
        },
      },
    })

    // Deploy default category and archive category
    const categoryClient = new CategoryClient(this.client)
    const categories = await categoryClient.deployManyDiscordCategory(
      discordClient,
      ["CHANNEL", "ARCHIVE"]
    )
    const defaultCategory = categories[0]
    const archiveCategory = categories[1]

    // Deploy all discord channel
    const discordChannels: DiscordChannel[] = await Promise.all(
      slackChannels.map(async (channel) => {
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
          type: 1,
          topic: result.topic,
          isArchived: channel.isArchived,
          createdAt: result.createdAt,
          updatedAt: result.createdAt,
        }
      })
    )

    // Update all discord channel data
    await this.updateManyDiscordChannel(discordChannels)
  }

  /**
   * Destroy all discord channel
   */
  async destroyAllDiscordChannel(discordClient: DiscordClient) {
    // Get all discord channel data
    const discordChannels = await this.client.discordChannel.findMany({
      where: {
        type: {
          equals: 1,
        },
      },
    })

    // Destroy all discord channel
    await Promise.all(
      discordChannels.map(async (channel) => {
        try {
          await discordClient.channels.delete(channel.channelId)
        } catch (error) {
          if (error instanceof DiscordAPIError && error.code == 10003) {
            // Do not throw error if channel to be deleted does not exist
          } else {
            throw error
          }
        }
      })
    )

    // Delete all discord channel data
    await this.client.discordChannel.deleteMany({
      where: {
        type: {
          equals: 1,
        },
      },
    })

    // Destroy all discord category
    const categoryClient = new CategoryClient(this.client)
    await categoryClient.destroyAllDiscordCategory(discordClient)
  }

  /**
   * Get slack channel file
   * @param channelFilePath
   */
  async getSlackChannelFile(channelFilePath: string) {
    await access(channelFilePath, constants.R_OK)
    return JSON.parse(
      await readFile(channelFilePath, "utf8")
    ) as SlackChannelFile[]
  }

  /**
   * Update single slack channel
   * @param channel
   */
  async updateSlackChannel(channel: SlackChannel) {
    await this.client.slackChannel.upsert({
      where: {
        channelId: channel.channelId,
      },
      update: {
        channelId: channel.channelId,
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
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
      },
    })
  }

  /**
   * Update many slack channel
   * @param channels
   */
  async updateManySlackChannel(channels: SlackChannel[]) {
    const query = channels.map((channel) =>
      this.client.slackChannel.upsert({
        where: {
          channelId: channel.channelId,
        },
        update: {
          channelId: channel.channelId,
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
          createdAt: channel.createdAt,
          updatedAt: channel.updatedAt,
        },
      })
    )
    await this.client.$transaction([...query])
  }

  /**
   * Update single discord channel data
   * @param channel
   */
  async updateDiscordChannel(channel: DiscordChannel) {
    await this.client.discordChannel.upsert({
      where: {
        channelId: channel.channelId,
      },
      update: {
        name: channel.name,
        channelId: channel.channelId,
        categoryId: channel.categoryId,
        slackChannelId: channel.slackChannelId,
        type: channel.type,
        topic: channel.topic,
        isArchived: channel.isArchived,
      },
      create: {
        name: channel.name,
        channelId: channel.channelId,
        categoryId: channel.categoryId,
        slackChannelId: channel.slackChannelId,
        type: channel.type,
        topic: channel.topic,
        isArchived: channel.isArchived,
        createdAt: channel.createdAt,
        updatedAt: channel.updatedAt,
      },
    })
  }

  /**
   * Update many discord channel data
   * @param channels
   */
  async updateManyDiscordChannel(channels: DiscordChannel[]) {
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
          type: channel.type,
          topic: channel.topic,
          isArchived: channel.isArchived,
        },
        create: {
          name: channel.name,
          channelId: channel.channelId,
          categoryId: channel.categoryId,
          slackChannelId: channel.slackChannelId,
          type: channel.type,
          topic: channel.topic,
          isArchived: channel.isArchived,
          createdAt: channel.createdAt,
          updatedAt: channel.updatedAt,
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
