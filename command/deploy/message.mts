import { Command } from "commander"
import dotenv from "dotenv"
import pc from "picocolors"
import { readFile, access } from "node:fs/promises"
// TODO: 後でfsPromise.constantsを使うようにする
import { constants } from "node:fs"
import { resolve, join } from "node:path"
import { Client, GatewayIntentBits } from "discord.js"
import type { Guild } from "discord.js"
import { Spinner } from "../../libs/util/spinner.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { createMessages } from "../../libs/message.mjs"
import type { Message } from "../../libs/message.mjs"

const __dirname = new URL(import.meta.url).pathname
const distDirPath = resolve(__dirname, "../../../.dist/")
const distChannelFilePath = join(distDirPath, "channel.json")

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
    .description("Deploy message")
    .requiredOption(
      "-dt, --discord-bot-token [string]",
      "DiscordBot oauth token",
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
    errorMessages.push("DiscordBot OAuth Token is required")
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

  // Discordのクライアントを認証する
  spinner.start(pc.blue("Authenticating discord..."))
  let guild: Guild | undefined = undefined
  try {
    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    })
    await client.login(discordBotToken)
    guild = client.guilds.cache.get(discordServerId)
  } catch (error) {
    spinner.stop(pc.blue("Authenticating discord... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  if (!guild) {
    spinner.stop(pc.blue("Authenticating discord... " + pc.red("Failed")))
    console.error("Guild not found")
    process.exit(0)
  }
  spinner.stop(pc.blue("Authenticating discord... " + pc.green("Success")))

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

  // メッセージを作成する
  spinner.start(pc.blue("Creating message..."))
  try {
    for (const channel of channels) {
      for (const messageFilePath of channel.discord.message_file_paths) {
        await access(messageFilePath, constants.R_OK)
        const messages = JSON.parse(
          await readFile(messageFilePath, "utf8")
        ) as Message[]
        const newMessages = await createMessages(
          guild,
          channel.discord.channel_id,
          messages
        )
      }
    }
  } catch (error) {
    spinner.stop(pc.blue("Creating message... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Creating message... " + pc.green("Success")))

  process.exit(0)
})()
