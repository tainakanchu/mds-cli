import { Command } from "commander"
import dotenv from "dotenv"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve, join, dirname } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import {
  createChannel,
  getChannelFile,
  createChannelFile,
} from "../../libs/channel.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { createCategory, createCategoryFile } from "../../libs/category.mjs"
import type { Category } from "../../libs/category.mjs"

const __dirname = new URL(import.meta.url).pathname
const distDirPath = resolve(__dirname, "../../../.dist/")
const distCategoryFilePath = join(distDirPath, "category.json")
const distChannelFilePath = join(distDirPath, "channel.json")

dotenv.config({ path: "./.envrc" })
const spinner = new Spinner()

interface Options {
  discordBotToken?: string
  discordServerId?: string
  migrateArchive?: boolean
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
    .requiredOption(
      "-ma, --migrate-archive [boolean]",
      "Whether to migrate archive channel",
      process.env.MIGRATE_ARCHIVE === "true" ? true : false
    )
    .parse(process.argv)

  // パラメーターの取得
  spinner.loading("Check parameter")
  const options: Options = program.opts()
  const { discordBotToken, discordServerId, migrateArchive } = options
  if (
    discordBotToken === undefined ||
    discordServerId === undefined ||
    migrateArchive === undefined
  ) {
    spinner.failed(null, "Required parameter is not found")
    process.exit(0)
  }
  spinner.success()

  // チャンネルファイルを取得する
  spinner.loading("Get channel file")
  let channels: Channel[] = []
  try {
    channels = await getChannelFile(distChannelFilePath)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // チャンネルのカテゴリーを作成する
  spinner.loading("Build category")
  let categories: Category[] = []
  let defaultCategory: Category | undefined = undefined
  let archiveCategory: Category | undefined = undefined
  try {
    categories = await createCategory(discordBotToken, discordServerId, [
      { id: "", name: "CHANNEL" },
      { id: "", name: "ARCHIVE" },
    ])
    defaultCategory = categories.find((category) => category.name === "CHANNEL")
    archiveCategory = categories.find((category) => category.name === "ARCHIVE")
    if (!defaultCategory || !archiveCategory) {
      throw new Error("Category is not found")
    }
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // カテゴリーファイルを作成する
  spinner.loading("Create category file")
  try {
    await createCategoryFile(distCategoryFilePath, categories)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // チャンネルを作成する
  spinner.loading("Create channel")
  try {
    channels = await createChannel(
      discordBotToken,
      discordServerId,
      channels,
      defaultCategory,
      archiveCategory,
      migrateArchive
    )
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // チャンネルファイルを更新する
  spinner.loading("Update channel file")
  try {
    await createChannelFile(distChannelFilePath, channels)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
