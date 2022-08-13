import { Command } from "commander"
import dotenv from "dotenv"
import pc from "picocolors"
import { readFile, access, mkdir, writeFile } from "node:fs/promises"
// BUG: @types/nodeにfsPromises.constantsが無いので代用
// https://github.com/nodejs/node/issues/44209
import { constants } from "node:fs"
import { resolve, join, dirname } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { createChannels } from "../../libs/channel.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { createCategories } from "../../libs/category.mjs"
import type { Category } from "../../libs/category.mjs"

const __dirname = new URL(import.meta.url).pathname
const migrationDirPath = resolve(__dirname, "../../../.migration/")
const categoryFilePath = join(migrationDirPath, "category.json")
const channelFilePath = join(migrationDirPath, "channel.json")

dotenv.config({ path: "./.envrc" })
const spinner = new Spinner()

interface Options {
  discordBotToken?: string
  discordServerId?: string
  isMigrateArchive?: boolean
}

;(async () => {
  const program = new Command()
  program
    .description("Deploy channel")
    .requiredOption(
      "-dt, --discord-bot-token [string]",
      "Discord bot oauth token",
      process.env.DISCORD_BOT_TOKEN
    )
    .requiredOption(
      "-ds, --discord-server-id [string]",
      "Discord server id",
      process.env.DISCORD_SERVER_ID
    )
    .requiredOption(
      "-ma, --is-migrate-archive [boolean]",
      "Whether to migrate archive channel",
      process.env.IS_MIGRATE_ARCHIVE === "false" ? false : true
    )
    .parse(process.argv)

  // パラメーターの取得
  spinner.start(pc.blue("Checking parameters..."))
  const options: Options = program.opts()
  const { discordBotToken, discordServerId, isMigrateArchive } = options
  let isFailed = false
  const errorMessages = []

  if (discordBotToken === undefined) {
    errorMessages.push("Discord Bot OAuth Token is required")
    isFailed = true
  }
  if (discordServerId === undefined) {
    errorMessages.push("Discord Server Id is required")
    isFailed = true
  }

  if (
    isFailed ||
    discordBotToken === undefined ||
    discordServerId === undefined ||
    isMigrateArchive === undefined
  ) {
    spinner.stop(pc.blue("Checking parameters... " + pc.red("Failed")))
    console.error(pc.red(errorMessages.join("\n")))
    process.exit(0)
  }
  spinner.stop(pc.blue("Checking parameters... " + pc.green("Success")))

  // チャンネル情報を取得する
  spinner.start(pc.blue("Getting channel file..."))
  let channels: Channel[] = []
  try {
    await access(channelFilePath, constants.R_OK)
    channels = JSON.parse(await readFile(channelFilePath, "utf8")) as Channel[]
  } catch (error) {
    spinner.stop(pc.blue("Getting channel file... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Getting channel file... " + pc.green("Success")))

  // Discordのチャンネルのカテゴリーを作成する
  spinner.start(pc.blue("Creating category..."))
  let categories: Category[] = []
  let defaultCategory: Category | undefined = undefined
  let archiveCategory: Category | undefined = undefined
  try {
    categories = await createCategories(discordBotToken, discordServerId, [
      { name: "CHANNEL" },
      { name: "ARCHIVE" },
    ])
    defaultCategory = categories.find((category) => category.name === "CHANNEL")
    archiveCategory = categories.find((category) => category.name === "ARCHIVE")
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
  spinner.start(pc.blue("Creating category file..."))
  try {
    await mkdir(dirname(categoryFilePath), {
      recursive: true,
    })
    await writeFile(categoryFilePath, JSON.stringify(categories, null, 2))
  } catch (error) {
    spinner.stop(pc.blue("Creating category file... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Creating category file... " + pc.green("Success")))

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
      isMigrateArchive
    )
  } catch (error) {
    spinner.stop(pc.blue("Creating channel... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Creating channel... " + pc.green("Success")))

  // チャンネル情報を更新する
  spinner.start(pc.blue("Updating channel file..."))
  try {
    await mkdir(dirname(channelFilePath), {
      recursive: true,
    })
    await writeFile(channelFilePath, JSON.stringify(newChannels, null, 2))
  } catch (error) {
    spinner.stop(pc.blue("Updating channel file... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Updating channel file... " + pc.green("Success")))

  process.exit(0)
})()
