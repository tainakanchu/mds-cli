import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import type { Guild as DiscordClientType } from "discord.js"
import { Spinner } from "../../libs/util/spinner.mjs"
import { createDiscordClient } from "../../libs/client.mjs"
import { getChannelFile } from "../../libs/channel.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { getCategoryFile } from "../../libs/category.mjs"
import type { Category } from "../../libs/category.mjs"
import { deployUserImage, getUserFile } from "../../libs/user.mjs"
import type { User } from "../../libs/user.mjs"

const __dirname = new URL(import.meta.url).pathname
const distDirPath = resolve(__dirname, "../../../.dist/")
const distChannelFilePath = join(distDirPath, "channel.json")
const distCategoryFilePath = join(distDirPath, "category.json")
const distUserFilePath = join(distDirPath, "user.json")

dotenv.config({ path: "./.env" })
const spinner = new Spinner()

interface Options {
  discordBotToken?: string
  discordServerId?: string
}

;(async () => {
  const program = new Command()
  program
    .description("Deploy user image command")
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

  // カテゴリーを取得する
  spinner.loading("Get category")
  let categories: Category[] | null = null
  try {
    categories = await getCategoryFile(distCategoryFilePath)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // アーカイブカテゴリーを取得する
  const archiveCategory = categories.find(
    (category) => category.name === "ARCHIVE"
  )
  if (!archiveCategory) {
    spinner.failed(null, "Failed to get archive category")
    process.exit(0)
  }
  spinner.success()

  // ユーザーを取得する
  spinner.loading("Get user")
  let users: User[] | null = null
  try {
    users = await getUserFile(distUserFilePath)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // ユーザーの画像をデプロイする
  spinner.loading("Deploy user image")
  try {
    await deployUserImage(
      discordClient,
      distChannelFilePath,
      channels,
      archiveCategory.id,
      distUserFilePath,
      users
    )
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
