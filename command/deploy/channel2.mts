import { Command } from "commander"
import dotenv from "dotenv"
import type { Guild as DiscordClient } from "discord.js"
import { Spinner } from "../../libs/util/spinner.mjs"
import { createDiscordClient } from "../../libs/client.mjs"
import { ChannelClient } from "../../libs/channel2.mjs"
import type { SlackChannel } from "@prisma/client"

dotenv.config({ path: "./.env" })
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
    process.exit(1)
  }
  spinner.success()

  // クライアントを作成
  spinner.loading("Create client")
  let channelClient: ChannelClient | undefined = undefined
  let discordClient: DiscordClient | null = null
  try {
    channelClient = new ChannelClient()
    discordClient = await createDiscordClient(discordBotToken, discordServerId)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(1)
  }
  spinner.success()

  // チャンネルを取得
  spinner.loading("Get channel")
  let channels: SlackChannel[] | undefined = undefined
  try {
    channels = await channelClient.getSlackChannelMany()
  } catch (error) {
    spinner.failed(null, error)
    process.exit(1)
  }
  spinner.success()

  // チャンネルをデプロイ
  spinner.loading("Deploy channel")
  try {
    await channelClient.deployChannel(discordClient, channels)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(1)
  }
  spinner.success()

  process.exit(0)
})()
