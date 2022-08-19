import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { createDiscordClient } from "../../libs/client.mjs"
import { deployChannel, getChannelFile } from "../../libs/channel.mjs"
import { createCategory } from "../../libs/category.mjs"

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

  // チャンネルのカテゴリーを作成する
  spinner.loading("Create category")
  const { categories, ...createCategoryResult } = await createCategory(
    discordClient,
    [
      { id: "", name: "CHANNEL" },
      { id: "", name: "ARCHIVE" },
    ],
    distCategoryFilePath
  )
  if (createCategoryResult.status === "failed") {
    spinner.failed(null, createCategoryResult.message)
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
  const deployChannelResult = await deployChannel(
    discordClient,
    channels,
    distChannelFilePath,
    defaultCategory,
    archiveCategory
  )
  if (deployChannelResult.status === "failed") {
    spinner.failed(null, deployChannelResult.message)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
