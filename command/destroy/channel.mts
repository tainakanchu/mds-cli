import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import prompts from "prompts"
import { Spinner } from "../../libs/util/spinner.mjs"
import { createDiscordClient } from "../../libs/client.mjs"
import { deleteChannel, getChannelFile } from "../../libs/channel.mjs"
import { deleteCategory, getCategoryFile } from "../../libs/category.mjs"

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
  // コマンドの実行確認
  const confirm = await prompts({
    type: "confirm",
    name: "value",
    message: "Delete channel?",
  })
  if (!confirm.value) process.exit(0)

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
  const { discordClient, ...createDiscordClientResult } =
    await createDiscordClient(discordBotToken, discordServerId)
  if (!discordClient || createDiscordClientResult.status === "failed") {
    spinner.failed(null, createDiscordClientResult.message)
    process.exit(0)
  }
  spinner.success()

  // チャンネルを取得する
  spinner.loading("Get channel")
  const { channels, ...getChannelFileResult } = await getChannelFile(
    distChannelFilePath
  )
  if (getChannelFileResult.status === "failed") {
    spinner.failed(null, getChannelFileResult.message)
    process.exit(0)
  }
  spinner.success()

  // カテゴリーを取得する
  spinner.loading("Get category")
  const { categories, ...getCategoryFileResult } = await getCategoryFile(
    distCategoryFilePath
  )
  if (getCategoryFileResult.status === "failed") {
    spinner.failed(null, getCategoryFileResult.message)
    process.exit(0)
  }
  spinner.success()

  // チャンネルを削除する
  spinner.loading("Delete channel")
  const deleteChannelResult = await deleteChannel(discordClient, channels)
  if (deleteChannelResult.status === "failed") {
    spinner.failed(null, deleteChannelResult.message)
    process.exit(0)
  }
  spinner.success()

  // カテゴリーを削除する
  spinner.loading("Delete category")
  const deleteCategoryResult = await deleteCategory(discordClient, categories)
  if (deleteCategoryResult.status === "failed") {
    spinner.failed(null, deleteCategoryResult.message)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
