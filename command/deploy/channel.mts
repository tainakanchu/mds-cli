import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import type { Guild as DiscordClientType } from "discord.js"
import { Spinner } from "../../libs/util/spinner.mjs"
import { createDiscordClient } from "../../libs/client.mjs"
import { deployChannel, getChannelFile } from "../../libs/channel.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { createCategory } from "../../libs/category.mjs"
import type { Category } from "../../libs/category.mjs"

const __dirname = new URL(import.meta.url).pathname
const distDirPath = resolve(__dirname, "../../../.dist/")
const distCategoryFilePath = join(distDirPath, "category.json")
const distChannelFilePath = join(distDirPath, "channel.json")

dotenv.config({ path: "./.env" })
const spinner = new Spinner()

interface Options {
  discordBotToken?: string
  discordServerId?: string
}

;(async () => {
  const program = new Command()
  program
    .description("Deploy channel command")
    .requiredOption(
      "-dt, --discord-bot-token [string]",
      "DiscordBot OAuth Token",
      process.env.DISCORD_BOT_TOKEN
    )
    .requiredOption(
      "-ds, --discord-server-id [string]",
      "Discord Server ID",
      process.env.DISCORD_SERVER_ID
    )
    .parse(process.argv)

  // パラメーターの取得
  spinner.loading("Check parameter")
  const options: Options = program.opts()
  const { discordBotToken, discordServerId } = options
  if (discordBotToken === undefined || discordServerId === undefined) {
    spinner.failed(null, "Required parameter is not found")
    process.exit(0)
  }
  spinner.success()

  // Discordのクライアントを作成する
  spinner.loading("Create discord client")
  let discordClient: DiscordClientType | null = null
  try {
    discordClient = await createDiscordClient(discordBotToken, discordServerId)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // チャンネルを取得する
  spinner.loading("Get channel")
  let channels: Channel[] | null = null
  try {
    channels = await getChannelFile(distChannelFilePath)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // チャンネルのカテゴリーを作成する
  spinner.loading("Create category")
  let categories: Category[] | null = null
  try {
    categories = await createCategory(
      discordClient,
      [
        { id: "", name: "CHANNEL" },
        { id: "", name: "ARCHIVE" },
      ],
      distCategoryFilePath
    )
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }

  // デフォルトカテゴリーとアーカイブカテゴリーを取得する
  const defaultCategory = categories.find(
    (category) => category.name === "CHANNEL"
  )
  const archiveCategory = categories.find(
    (category) => category.name === "ARCHIVE"
  )
  if (!defaultCategory || !archiveCategory) {
    spinner.failed(null, "Failed to create category")
    process.exit(0)
  }
  spinner.success()

  // チャンネルをデプロイする
  spinner.loading("Deploy channel")
  try {
    await deployChannel(
      discordClient,
      channels,
      distChannelFilePath,
      defaultCategory,
      archiveCategory
    )
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
