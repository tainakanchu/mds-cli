import { Command } from "commander"
import dotenv from "dotenv"
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
const distDirPath = resolve(__dirname, "../../../.dist/")
const distCategoryFilePath = join(distDirPath, "category.json")
const distChannelFilePath = join(distDirPath, "channel.json")

dotenv.config({ path: "./.envrc" })
const spinner = new Spinner()

interface Options {
  discordBotToken?: string
  discordServerId?: string
}

;(async () => {
  const program = new Command()
  program
    .description("Delete channel command")
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
  spinner.loading("Check parameters")
  const options: Options = program.opts()
  const { discordBotToken, discordServerId } = options
  if (discordBotToken === undefined || discordServerId === undefined) {
    spinner.failed(null, "Required parameters are not found")
    process.exit(0)
  }
  spinner.success()

  // チャンネル情報を取得する
  spinner.loading("Get channel data")
  let channels: Channel[] = []
  try {
    await access(distChannelFilePath, constants.R_OK)
    channels = JSON.parse(
      await readFile(distChannelFilePath, "utf8")
    ) as Channel[]
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // カテゴリー情報を取得する
  spinner.loading("Get category data")
  let categories: Category[] = []
  try {
    await access(distCategoryFilePath, constants.R_OK)
    categories = JSON.parse(
      await readFile(distCategoryFilePath, "utf8")
    ) as Category[]
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // Discordのチャンネルを削除する
  spinner.loading("Delete channel")
  let newChannels: Channel[] = []
  try {
    newChannels = await deleteChannels(
      discordBotToken,
      discordServerId,
      channels
    )
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // チャンネル情報を更新する
  spinner.loading("Update channel data")
  try {
    await mkdir(dirname(distChannelFilePath), {
      recursive: true,
    })
    await writeFile(distChannelFilePath, JSON.stringify(newChannels, null, 2))
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // Discordのカテゴリーを削除する
  spinner.loading("Delete category")
  let newCategories: Category[] = []
  try {
    newCategories = await deleteCategories(
      discordBotToken,
      discordServerId,
      categories
    )
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // カテゴリー情報のファイルを更新する
  spinner.loading("Update category data")
  try {
    await mkdir(dirname(distCategoryFilePath), {
      recursive: true,
    })
    await writeFile(
      distCategoryFilePath,
      JSON.stringify(newCategories, null, 2)
    )
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
