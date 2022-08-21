import { ChannelType, DiscordAPIError } from "discord.js"
import type { Guild as DiscordClient } from "discord.js"
import retry from "async-retry"
import { PrismaClient } from "@prisma/client"
import type { DiscordCategory } from "@prisma/client"

export class CategoryClient {
  client: PrismaClient
  constructor(client = new PrismaClient()) {
    this.client = client
  }

  /**
   * Deploy many discord category
   * @param discordClient
   * @param categoryNames
   */
  async deployManyDiscordCategory(
    discordClient: DiscordClient,
    categoryNames: string[]
  ) {
    // Create discord category
    const discordCategories: DiscordCategory[] = await Promise.all(
      categoryNames.map(async (categoryName) => {
        const newCategory = await retry(
          async () =>
            await discordClient.channels.create({
              name: categoryName,
              type: ChannelType.GuildCategory,
            })
        )
        return {
          id: 0,
          categoryId: newCategory.id,
          name: newCategory.name,
        }
      })
    )

    // Update discord category data
    await this.updateManyDiscordCategory(discordCategories)

    return discordCategories
  }

  /**
   * Destroy all discord category
   */
  async destroyAllDiscordCategory(discordClient: DiscordClient) {
    // Get all discord category data
    const discordCategories = await this.client.discordCategory.findMany()

    // Destroy all discord category
    await Promise.all(
      discordCategories.map(async (category) => {
        try {
          await discordClient.channels.delete(category.categoryId)
        } catch (error) {
          if (error instanceof DiscordAPIError && error.code == 10003) {
            // Do not throw error if category to be deleted does not exist
          } else {
            throw error
          }
        }
      })
    )

    // Delete all discord category data
    await this.client.discordCategory.deleteMany()
  }

  /**
   * Update many discord category
   * @param categories
   */
  async updateManyDiscordCategory(categories: DiscordCategory[]) {
    const query = categories.map((category) =>
      this.client.discordCategory.upsert({
        where: {
          categoryId: category.categoryId,
        },
        update: {
          categoryId: category.categoryId,
          name: category.name,
        },
        create: {
          categoryId: category.categoryId,
          name: category.name,
        },
      })
    )
    await this.client.$transaction([...query])
  }
}
