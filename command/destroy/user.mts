import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import prompts from "prompts"
import type { Guild as DiscordClientType } from "discord.js"
import { Spinner } from "../../libs/util/spinner.mjs"
import { createDiscordClient } from "../../libs/client.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { deleteChannel, getChannelFile } from "../../libs/channel.mjs"

const __dirname = new URL(import.meta.url).pathname
const distDirPath = resolve(__dirname, "../../../.dist/")
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
    message: "Delete user image host channel?",
  })
  if (!confirm.value) process.exit(0)

  const program = new Command()
  program
    .description("Delete user image host channel command")
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
  spinner.loading("Get user image host channel")
  let channels: Channel[] | null = null
  try {
    channels = await getChannelFile(distChannelFilePath)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }

  // ユーザーの画像をホストしているチャンネルを取得する
  const userChannel = channels.find(
    (channel) => channel.type === "user_image_host"
  )
  if (userChannel === undefined) {
    spinner.failed(null, "Failed to get user image host channel")
    process.exit(0)
  }
  spinner.success()

  // ユーザーの画像をホストしているチャンネルを削除する
  spinner.loading("Delete user image host channel")
  try {
    await deleteChannel(discordClient, [userChannel])
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
