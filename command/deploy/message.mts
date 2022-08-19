import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import type { Guild as DiscordClientType } from "discord.js"
import { Spinner } from "../../libs/util/spinner.mjs"
import { createDiscordClient } from "../../libs/client.mjs"
import { getChannelFile } from "../../libs/channel.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { deployAllMessage } from "../../libs/message.mjs"

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
  const program = new Command()
  program
    .description("Deploy message command")
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

  // メッセージをデプロイする
  spinner.loading("Deploy message")
  let isMaxFileSizeOver = false
  try {
    const deployAllMessageResult = await deployAllMessage(
      discordClient,
      channels
    )
    if (deployAllMessageResult.isMaxFileSizeOver) isMaxFileSizeOver = true
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // メッセージに最大ファイルサイズを超えているファイルがある場合は警告を出力する
  if (isMaxFileSizeOver) {
    spinner.warning(
      "Message has attachments that exceed Discord's maximum file size.\nAttachments that exceed Discord's maximum file size will be appended to the message as a file URL.\nConsider releasing the maximum file upload size limit with Discord's server boost."
    )
  }

  process.exit(0)
})()
