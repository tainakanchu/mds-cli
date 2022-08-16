import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { createDiscordGuild } from "../../libs/client.mjs"
import { getChannelFile } from "../../libs/channel.mjs"
import { createAllMessage } from "../../libs/message.mjs"

const __dirname = new URL(import.meta.url).pathname
const distDirPath = resolve(__dirname, "../../../.dist/")
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

  // Discordのギルドを作成する
  spinner.loading("Create discord guild")
  const { discordGuild, ...createDiscordGuildResult } =
    await createDiscordGuild(discordBotToken, discordServerId)
  if (!discordGuild || createDiscordGuildResult.status === "failed") {
    spinner.failed(null, createDiscordGuildResult.message)
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

  // メッセージを作成する
  spinner.loading("Create message")
  const createAllMessageResult = await createAllMessage(discordGuild, channels)
  if (createAllMessageResult.status === "failed") {
    spinner.failed(null, createAllMessageResult.message)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
