import { PrismaClient, SlackUser } from "@prisma/client"
import { access, readFile, constants } from "node:fs/promises"
import { ChannelType, DiscordAPIError } from "discord.js"
import type { Guild as DiscordClient } from "discord.js"
import retry from "async-retry"

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
   * Update many slack user
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
        },
      })
    )
    await this.client.$transaction([...query])
  }
}
