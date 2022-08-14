import { Command } from "commander"
import dotenv from "dotenv"
import pc from "picocolors"
import { readFile, access, mkdir, writeFile } from "node:fs/promises"
// TODO: 後でfsPromise.constantsを使うようにする
import { constants } from "node:fs"
import { resolve, join, dirname } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { deleteChannels } from "../../libs/channel.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { deleteCategories } from "../../libs/category.mjs"
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
}

;(async () => {
  const program = new Command()
  program
    .description("Delete channel")
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
    .parse(process.argv)

  // パラメーターの取得
  spinner.start(pc.blue("Checking parameters..."))
  const options: Options = program.opts()
  const { discordBotToken, discordServerId } = options
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
    discordServerId === undefined
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
    await access(channelFilePath, constants.R_OK)
    channels = JSON.parse(await readFile(channelFilePath, "utf8")) as Channel[]
  } catch (error) {
    spinner.stop(pc.blue("Getting channel data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Getting channel data... " + pc.green("Success")))

  // カテゴリー情報を取得する
  spinner.start(pc.blue("Getting category data..."))
  let categories: Category[] = []
  try {
    await access(categoryFilePath, constants.R_OK)
    categories = JSON.parse(
      await readFile(categoryFilePath, "utf8")
    ) as Category[]
  } catch (error) {
    spinner.stop(pc.blue("Getting category data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Getting category data... " + pc.green("Success")))

  // Discordのチャンネルを削除する
  spinner.start(pc.blue("Deleting channel..."))
  let newChannels: Channel[] = []
  try {
    newChannels = await deleteChannels(
      discordBotToken,
      discordServerId,
      channels
    )
  } catch (error) {
    spinner.stop(pc.blue("Deleting channel... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Deleting channel... " + pc.green("Success")))

  // チャンネル情報を更新する
  spinner.start(pc.blue("Updating channel data..."))
  try {
    await mkdir(dirname(channelFilePath), {
      recursive: true,
    })
    await writeFile(channelFilePath, JSON.stringify(newChannels, null, 2))
  } catch (error) {
    spinner.stop(pc.blue("Updating channel data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Updating channel data... " + pc.green("Success")))

  // Discordのカテゴリーを削除する
  spinner.start(pc.blue("Deleting category..."))
  let newCategories: Category[] = []
  try {
    newCategories = await deleteCategories(
      discordBotToken,
      discordServerId,
      categories
    )
  } catch (error) {
    spinner.stop(pc.blue("Deleting category... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Deleting category... " + pc.green("Success")))

  // カテゴリー情報のファイルを更新する
  spinner.start(pc.blue("Updating category data..."))
  try {
    await mkdir(dirname(categoryFilePath), {
      recursive: true,
    })
    await writeFile(categoryFilePath, JSON.stringify(newCategories, null, 2))
  } catch (error) {
    spinner.stop(pc.blue("Updating category data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Updating category data... " + pc.green("Success")))

  process.exit(0)
})()
