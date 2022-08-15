import { Command } from "commander"
import dotenv from "dotenv"
import pc from "picocolors"
import { readFile, access, mkdir, writeFile } from "node:fs/promises"
// TODO: 後でfsPromise.constantsを使うようにする
import { constants } from "node:fs"
import { resolve, join, dirname } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { createChannels } from "../../libs/channel.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { createCategories } from "../../libs/category.mjs"
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
  spinner.start(pc.blue("Checking parameters..."))
  const options: Options = program.opts()
  const { discordBotToken, discordServerId, migrateArchive } = options
  let isFailed = false
  const errorMessages = []

  if (discordBotToken === undefined) {
    errorMessages.push("DiscordBot OAuth Token is required")
    isFailed = true
  }
  if (discordServerId === undefined) {
    errorMessages.push("Discord Server ID is required")
    isFailed = true
  }
  if (migrateArchive === undefined) {
    errorMessages.push("Migrate archive Flag is required")
    isFailed = true
  }

  if (
    isFailed ||
    discordBotToken === undefined ||
    discordServerId === undefined ||
    migrateArchive === undefined
  ) {
    spinner.stop(pc.blue("Checking parameters... " + pc.red("Failed")))
    console.error(pc.red(errorMessages.join("\n")))
    process.exit(0)
  }
  spinner.stop(pc.blue("Checking parameters... " + pc.green("Success")))

  // チャンネル情報を取得する
  spinner.start(pc.blue("Getting channel data..."))
  let channels: Channel[] = []
  try {
    await access(distChannelFilePath, constants.R_OK)
    channels = JSON.parse(
      await readFile(distChannelFilePath, "utf8")
    ) as Channel[]
  } catch (error) {
    spinner.stop(pc.blue("Getting channel data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Getting channel data... " + pc.green("Success")))

  // Discordのチャンネルのカテゴリーを作成する
  spinner.start(pc.blue("Creating category..."))
  let newCategories: Category[] = []
  let defaultCategory: Category | undefined = undefined
  let archiveCategory: Category | undefined = undefined
  try {
    newCategories = await createCategories(discordBotToken, discordServerId, [
      { id: "", name: "CHANNEL" },
      { id: "", name: "ARCHIVE" },
    ])
    defaultCategory = newCategories.find(
      (category) => category.name === "CHANNEL"
    )
    archiveCategory = newCategories.find(
      (category) => category.name === "ARCHIVE"
    )
    if (!defaultCategory || !archiveCategory) {
      throw new Error("Category is not found")
    }
  } catch (error) {
    spinner.stop(pc.blue("Creating category... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Creating category... " + pc.green("Success")))

  // カテゴリー情報のファイルを作成する
  spinner.start(pc.blue("Creating category data..."))
  try {
    await mkdir(dirname(distCategoryFilePath), {
      recursive: true,
    })
    await writeFile(
      distCategoryFilePath,
      JSON.stringify(newCategories, null, 2)
    )
  } catch (error) {
    spinner.stop(pc.blue("Creating category data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Creating category data... " + pc.green("Success")))

  // Discordのチャンネルを作成する
  spinner.start(pc.blue("Creating channel..."))
  let newChannels: Channel[] = []
  try {
    newChannels = await createChannels(
      discordBotToken,
      discordServerId,
      channels,
      defaultCategory,
      archiveCategory,
      migrateArchive
    )
  } catch (error) {
    spinner.stop(pc.blue("Creating channel... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Creating channel... " + pc.green("Success")))

  // チャンネル情報を更新する
  spinner.start(pc.blue("Updating channel data..."))
  try {
    await mkdir(dirname(distChannelFilePath), {
      recursive: true,
    })
    await writeFile(distChannelFilePath, JSON.stringify(newChannels, null, 2))
  } catch (error) {
    spinner.stop(pc.blue("Updating channel data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Updating channel data... " + pc.green("Success")))

  process.exit(0)
})()
