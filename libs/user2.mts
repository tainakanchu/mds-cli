import { PrismaClient, SlackUser, DiscordUser } from "@prisma/client"
import { access, readFile, constants } from "node:fs/promises"
import { ChannelType, DiscordAPIError } from "discord.js"
import type { Guild as DiscordClient } from "discord.js"
import retry from "async-retry"
import { ChannelClient } from "./channel2.mjs"

interface SlackUserChannelFile {
  id?: string
  is_bot?: boolean
  deleted?: boolean
  profile?: {
    real_name?: string
    display_name?: string
    email?: string
    image_512?: string
  }
}

export class UserClient {
  client: PrismaClient
  constructor(client = new PrismaClient()) {
    this.client = client
  }

  /**
   * Migrate user data
   * @param userFilePath
   */
  async migrateUser(userFilePath: string) {
    // Get user channel file
    const slackUsers = await this.getSlackUserFile(userFilePath)

    // Convert slack user data
    const newSlackUsers: SlackUser[] = slackUsers.map((user) => {
      if (
        user.id === undefined ||
        user.is_bot === undefined ||
        user.deleted === undefined ||
        user.profile === undefined ||
        user.profile.real_name === undefined ||
        user.profile.display_name === undefined ||
        user.profile.image_512 === undefined
      )
        throw new Error("User is missing required parameter")

      return {
        id: 0,
        userId: user.id,
        name: user.is_bot ? user.profile.real_name : user.profile.display_name,
        email: user.profile.email || null,
        imageUrl: user.profile.image_512,
        isBot: user.is_bot,
        isDeleted: user.deleted,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })

    // Update slack user data
    await this.updateManySlackUser(newSlackUsers)
  }

  /**
   * Get slack user file
   * @param userFilePath
   */
  async getSlackUserFile(userFilePath: string) {
    await access(userFilePath, constants.R_OK)
    return JSON.parse(
      await readFile(userFilePath, "utf8")
    ) as SlackUserChannelFile[]
  }

  /**
   * Update many slack user data
   * @param users
   */
  async updateManySlackUser(users: SlackUser[]) {
    const query = users.map((user) =>
      this.client.slackUser.upsert({
        where: {
          userId: user.userId,
        },
        update: {
          userId: user.userId,
          name: user.name,
          email: user.email,
          imageUrl: user.imageUrl,
          isBot: user.isBot,
          isDeleted: user.isDeleted,
        },
        create: {
          userId: user.userId,
          name: user.name,
          email: user.email,
          imageUrl: user.imageUrl,
          isBot: user.isBot,
          isDeleted: user.isDeleted,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      })
    )
    await this.client.$transaction([...query])
  }

  /**
   * Update many discord user data
   * @param users
   */
  async updateManyDiscordUser(users: DiscordUser[]) {
    const query = users.map((user) =>
      this.client.discordUser.upsert({
        where: {
          slackUserId: user.slackUserId,
        },
        update: {
          userId: user.userId,
          slackUserId: user.slackUserId,
          name: user.name,
          email: user.email,
          imageUrl: user.imageUrl,
          isBot: user.isBot,
          isDeleted: user.isDeleted,
        },
        create: {
          userId: user.userId,
          slackUserId: user.slackUserId,
          name: user.name,
          email: user.email,
          imageUrl: user.imageUrl,
          isBot: user.isBot,
          isDeleted: user.isDeleted,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      })
    )
    await this.client.$transaction([...query])
  }

  /**
   * Deploy all slack user image
   */
  async deployAllSlackUserImage(discordClient: DiscordClient) {
    // Deploy discord channel for uploading all slack user image
    const channelClient = new ChannelClient(this.client)
    await channelClient.updateSlackChannel({
      id: 0,
      channelId: "C0000000000",
      name: "mds-user",
      type: 2,
      topic: null,
      isArchived: true,
      pins: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const userChannel = await channelClient.deployDiscordChannel(
      discordClient,
      "mds-user",
      "C0000000000",
      {
        channelType: 2,
        topic: "channel for hosting user image",
        isArchived: true,
      }
    )

    // Get slack user data
    const slackUsers = await this.client.slackUser.findMany()

    // Deploy all slack user image
    const discordUsers: DiscordUser[] = []
    for (const slackUser of slackUsers) {
      // Upload slack user image to channel
      const message = await userChannel.send({
        content: slackUser.name,
        files: [slackUser.imageUrl],
      })

      discordUsers.push({
        id: 0,
        userId: null,
        slackUserId: slackUser.userId,
        name: slackUser.name,
        email: slackUser.email,
        imageUrl: message.attachments.map((file) => file.url)[0],
        isBot: slackUser.isBot,
        isDeleted: slackUser.isDeleted,
        createdAt: message.createdAt,
        updatedAt: message.createdAt,
      })
    }

    // Update discord user data
    await this.updateManyDiscordUser(discordUsers)
  }
}
