import { PrismaClient, SlackUser, DiscordUser } from "@prisma/client"
import { access, readFile, constants } from "node:fs/promises"
import type { Guild as DiscordClient } from "discord.js"
import { WebClient as SlackClient } from "@slack/web-api"
import { ChannelClient } from "./channel2.mjs"

interface SlackUserChannelFile {
  id?: string
  is_bot?: boolean
  deleted?: boolean
  color?: string
  profile?: {
    bot_id?: string
    api_app_id?: string
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
        appId: user.profile.api_app_id || null,
        botId: user.profile.bot_id || null,
        name: user.is_bot ? user.profile.real_name : user.profile.display_name,
        type: user.is_bot
          ? 1 // Bot
          : user.deleted
          ? 3 // Cancel user
          : 2, // Active user
        color: user.color ? parseInt(user.color, 16) : parseInt("808080", 16),
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
   * Get slack user
   * @param userId
   */
  async getSlackUser(slackClient: SlackClient, userId: string) {
    let user: SlackUser | null = null

    // Get slack bot
    user = await this.client.slackUser.findFirst({
      where: {
        userId: userId,
      },
      orderBy: {
        updatedAt: "desc",
      },
    })
    if (user) return user

    // Get slack user from API
    const result = await slackClient.users.info({ user: userId })

    if (
      result.user?.id === undefined ||
      result.user.profile?.real_name === undefined ||
      result.user.profile?.display_name === undefined ||
      result.user?.color === undefined ||
      result.user?.profile?.image_512 === undefined ||
      result.user?.is_bot === undefined ||
      result.user?.deleted === undefined
    )
      return null

    user = {
      id: 0,
      userId: result.user.id,
      appId: result.user.profile.api_app_id || null,
      botId: result.user.profile.bot_id || null,
      name: result.user.is_bot
        ? result.user.profile.real_name
        : result.user.profile.display_name,
      type: 1,
      color: result.user.color
        ? parseInt(result.user.color, 16)
        : parseInt("808080", 16),
      email: result.user.profile.email || null,
      imageUrl: result.user?.profile.image_512,
      isBot: result.user.is_bot,
      isDeleted: result.user?.deleted,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    return user
  }

  /**
   * Get slack bot
   * @param botId
   */
  async getSlackBot(slackClient: SlackClient, botId: string) {
    let bot: SlackUser | null = null

    bot = await this.client.slackUser.findFirst({
      where: {
        botId: botId,
        type: 1,
      },
    })
    if (bot) return bot

    const result = await slackClient.bots.info({ bot: botId })
    if (result.bot?.app_id) {
      bot = await this.client.slackUser.findFirst({
        where: {
          appId: result.bot.app_id,
          type: 1,
        },
      })
    }
    return bot
  }

  /**
   * Get discord user
   * @param userId
   */
  async getDiscordUser(userId: string) {
    return await this.client.discordUser.findFirst({
      where: {
        userId: userId,
      },
    })
  }

  /**
   * Get slack username
   * @param userId
   */
  async getSlackUsername(userId: string) {
    const user = await this.client.slackUser.findFirst({
      where: {
        userId: userId,
      },
    })
    return user ? user.name : null
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
          appId: user.appId,
          botId: user.botId,
          name: user.name,
          type: user.type,
          color: user.color,
          email: user.email,
          imageUrl: user.imageUrl,
          isBot: user.isBot,
          isDeleted: user.isDeleted,
        },
        create: {
          userId: user.userId,
          appId: user.appId,
          botId: user.botId,
          name: user.name,
          type: user.type,
          color: user.color,
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
   * Deploy channel for hosting user image
   */
  async deployUserImageChannel(discordClient: DiscordClient) {
    // Deploy channel for hosting user image
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

  /**
   * Destroy channel for hosting user image
   */
  async destroyUserImageChannel(discordClient: DiscordClient) {
    //  Get channel for hosting user image
    const channelClient = new ChannelClient(this.client)
    const userChannel = await channelClient.getDiscordChannel("mds-user", 2)
    if (!userChannel)
      throw new Error("Failed to get channel for hosting user image")

    // TODO: Destroy all message for channel for hosting user image

    // Destroy channel for hosting user image
    await channelClient.destroyDiscordChannel(
      discordClient,
      userChannel.channelId
    )
  }
}
