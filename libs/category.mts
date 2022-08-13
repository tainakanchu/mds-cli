import { ChannelType, Client, GatewayIntentBits } from "discord.js"

export interface Category {
  id: string
  name: string
}

export const createCategories = async (
  discordBotToken: string,
  discordServerId: string,
  categories: Category[]
) => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  })
  await client.login(discordBotToken)

  const newCategories: Category[] = []
  for (const category of categories) {
    const rusult = await client.guilds.cache
      .get(discordServerId)
      ?.channels.create({
        name: category.name,
        type: ChannelType.GuildCategory,
      })
    newCategories.push({ id: rusult?.id ? rusult.id : "", name: category.name })
  }
  return newCategories
}

export const deleteCategories = async (
  discordBotToken: string,
  discordServerId: string,
  categories: Category[]
) => {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  })
  await client.login(discordBotToken)

  const newCategories: Category[] = []
  for (const category of categories) {
    if (category.id) {
      // カテゴリーを削除する
      await client.guilds.cache
        .get(discordServerId)
        ?.channels.delete(category.id)
      // カテゴリーのIDを削除する
      category.id = ""
    }
    newCategories.push(category)
  }
  return newCategories
}
