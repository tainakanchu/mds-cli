import { ChannelType } from "discord.js"
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
   * Deploy category
   * @param discordClient
   * @param categoryNames
   */
  async deployCategory(discordClient: DiscordClient, categoryNames: string[]) {
    // Create category
    const newCategories: DiscordCategory[] = await Promise.all(
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

    // Update category data
    await this.updateDiscordCategoryMany(newCategories)

    return newCategories
  }

  /**
   * Update many discord category
   * @param categories
   */
  async updateDiscordCategoryMany(categories: DiscordCategory[]) {
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
