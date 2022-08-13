import { ChannelType, Client, GatewayIntentBits } from "discord.js"

export interface Category {
  id?: string
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
    newCategories.push({ id: rusult?.id, name: category.name })
  }
  return newCategories
}
