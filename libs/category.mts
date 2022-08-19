import { access, mkdir, writeFile, constants, readFile } from "node:fs/promises"
import { dirname } from "node:path"
import { ChannelType, DiscordAPIError } from "discord.js"
import type { Guild as DiscordClientType } from "discord.js"
import retry from "async-retry"

export interface Category {
  id: string
  name: string
}

/**
 * Get category file
 * @param distCategoryFilePath
 */
export const getCategoryFile = async (
  distCategoryFilePath: string
): Promise<Category[]> => {
  await access(distCategoryFilePath, constants.R_OK)
  const categories = JSON.parse(
    await readFile(distCategoryFilePath, "utf8")
  ) as Category[]
  return categories
}

/**
 * Create category file
 * @param distCategoryFilePath
 * @param categories
 */
export const createCategoryFile = async (
  distCategoryFilePath: string,
  categories: Category[]
): Promise<void> => {
  await mkdir(dirname(distCategoryFilePath), {
    recursive: true,
  })
  await writeFile(distCategoryFilePath, JSON.stringify(categories, null, 2))
}

/**
 * Deploy category
 * @param discordClient
 * @param categories
 * @param distCategoryFilePath
 */
export const deployCategory = async (
  discordClient: DiscordClientType,
  categories: Category[],
  distCategoryFilePath: string
): Promise<Category[]> => {
  // カテゴリーを作成する
  const newCategories = await Promise.all(
    categories.map(async (category) => {
      const newCategory = await retry(
        async () =>
          await discordClient.channels.create({
            name: category.name,
            type: ChannelType.GuildCategory,
          })
      )

      // カテゴリーの必須項目がない場合は例外を投げる
      if (newCategory.id === undefined)
        throw new Error("Failed to deploy category")

      return {
        id: newCategory.id,
        name: category.name,
      } as Category
    })
  )

  // カテゴリーファイルを作成する
  await createCategoryFile(distCategoryFilePath, newCategories)

  return newCategories
}

/**
 * Delete category
 * @param discordClient
 * @param categories
 */
export const deleteCategory = async (
  discordClient: DiscordClientType,
  categories: Category[]
): Promise<void> => {
  await Promise.all(
    categories.map(async (category) => {
      try {
        await retry(async () => {
          await discordClient.channels.delete(category.id)
        })
      } catch (error) {
        if (error instanceof DiscordAPIError && error.code == 10003) {
          // 削除対象のカテゴリーが存在しないエラーの場合は、何もしない
        } else {
          throw error
        }
      }
    })
  )
}
