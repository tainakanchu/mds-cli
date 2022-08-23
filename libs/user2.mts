import { PrismaClient, User } from "@prisma/client"
import { access, readFile, constants } from "node:fs/promises"
import { v4 as uuidv4 } from "uuid"
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
  channelClient: ChannelClient
  constructor(client = new PrismaClient()) {
    this.client = client
    this.channelClient = new ChannelClient(this.client)
  }

  /**
   * Migrate user data
   * @param userFilePath
   */
  async migrateUser(userFilePath: string) {
    const slackUsers = await this.getSlackUserFile(userFilePath)

    // Convert user data
    const newUsers: User[] = slackUsers.map((user) => {
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
        id: user.id,
        appId: user.profile.api_app_id || null,
        botId: user.profile.bot_id || null,
        name: user.is_bot ? user.profile.real_name : user.profile.display_name,
        type: user.is_bot
          ? 3 // Bot
          : user.deleted
          ? 2 // Cancel user
          : 1, // Active user
        color: user.color ? parseInt(user.color, 16) : parseInt("808080", 16),
        email: user.profile.email || null,
        imageUrl: user.profile.image_512,
        isBot: user.is_bot,
        isDeleted: user.deleted,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })
    await this.updateManyUser(newUsers)
  }

  /**
   * Get user
   * @param userId
   */
  async getUser(slackClient: SlackClient, userId: string) {
    let user: User | null = null

    // Get slack bot
    user = await this.client.user.findFirst({
      where: {
        id: userId,
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
      id: result.user.id,
      appId: result.user.profile.api_app_id || null,
      botId: result.user.profile.bot_id || null,
      name: result.user.is_bot
        ? result.user.profile.real_name
        : result.user.profile.display_name,
      type: result.user.deleted ? 2 : 1,
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
   * Get bot
   * @param botId
   */
  async getBot(slackClient: SlackClient, botId: string, appId?: string) {
    let bot: User | null = null

    bot = await this.client.user.findFirst({
      where: {
        botId: appId ? undefined : botId,
        appId: appId,
        type: 3,
      },
    })
    if (bot) return bot

    const result = await slackClient.bots.info({ bot: botId })
    if (
      result.bot !== undefined &&
      result.bot.app_id !== undefined &&
      result.bot.name !== undefined &&
      result.bot.icons?.image_72 !== undefined &&
      result.bot.deleted !== undefined
    ) {
      bot = await this.client.user.findFirst({
        where: {
          appId: result.bot.app_id,
          type: 3,
        },
      })
      if (bot) return bot

      bot = {
        id: uuidv4(),
        appId: result.bot.app_id,
        botId: botId,
        name: result.bot.name,
        type: 3,
        color: parseInt("808080", 16),
        email: null,
        imageUrl: result.bot.icons.image_72,
        isBot: true,
        isDeleted: result.bot.deleted,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }
    return bot
  }

  /**
   * Get username
   * @param userId
   */
  async getUsername(userId: string) {
    const user = await this.client.user.findFirst({
      where: {
        id: userId,
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
   * Update many user data
   * @param users
   */
  async updateManyUser(users: User[]) {
    const query = users.map((user) =>
      this.client.user.upsert({
        where: {
          id: user.id,
        },
        update: {
          id: user.id,
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
          id: user.id,
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
      })
    )
    await this.client.$transaction([...query])
  }

  /**
   * Deploy channel for hosting user image
   */
  async deployUserImageChannel(discordClient: DiscordClient) {
    // Deploy channel for hosting user image
    const userChannel = await this.channelClient.deployChannel(
      discordClient,
      "mds-user",
      "C0000000000",
      {
        channelType: 2,
        topic: "channel for hosting user image",
        isArchived: true,
      }
    )

    // Get all user data
    const users = await this.client.user.findMany()

    // Deploy all user image
    const newUsers: User[] = []
    for (const user of users) {
      const message = await userChannel.send({
        content: user.name,
        files: [user.imageUrl],
      })
      newUsers.push({
        id: user.id,
        appId: user.appId,
        botId: user.botId,
        type: user.type,
        color: user.color,
        name: user.name,
        email: user.email,
        imageUrl: message.attachments.map((file) => file.url)[0],
        isBot: user.isBot,
        isDeleted: user.isDeleted,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
    await this.updateManyUser(newUsers)
  }

  /**
   * Destroy channel for hosting user image
   */
  async destroyUserImageChannel(discordClient: DiscordClient) {
    const userChannel = await this.channelClient.getChannel("mds-user", 2)
    if (!userChannel || !userChannel.deployId)
      throw new Error("Failed to get deployed channel for hosting user image")

    // TODO: Destroy all message for channel for hosting user image

    await this.channelClient.destroyChannel(discordClient, userChannel)
  }
}
