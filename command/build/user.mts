import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import type { WebClient as SlackClientType } from "@slack/web-api"
import { Spinner } from "../../libs/util/spinner.mjs"
import { buildUser } from "../../libs/user.mjs"
import { getChannelFile } from "../../libs/channel.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { createSlackClient } from "../../libs/client.mjs"

const __dirname = new URL(import.meta.url).pathname
const srcDirPath = resolve(__dirname, "../../../.src/")
const srcUserFilePath = join(srcDirPath, "users.json")
const distDirPath = resolve(__dirname, "../../../.dist/")
const distChannelFilePath = join(distDirPath, "channel.json")
const distUserFilePath = join(distDirPath, "user.json")

dotenv.config({ path: "./.env" })
const spinner = new Spinner()

interface Options {
  slackBotToken?: string
}

;(async () => {
  const program = new Command()
  program
    .description("Build user file command")
    .requiredOption(
      "-st, --slack-bot-token [string]",
      "SlackBot OAuth Token",
      process.env.SLACK_BOT_TOKEN
    )
    .parse(process.argv)

  // パラメーターの取得
  spinner.loading("Check parameter")
  const options: Options = program.opts()
  const { slackBotToken } = options
  if (slackBotToken === undefined) {
    spinner.failed(null, "Required parameter is not found")
    process.exit(0)
  }
  spinner.success()

  // Slackのクライアントを作成する
  spinner.loading("Create slack client")
  let slackClient: SlackClientType | null = null
  try {
    slackClient = createSlackClient(slackBotToken)
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

  // ユーザーファイルを作成する
  spinner.loading("Build user file")
  try {
    await buildUser(srcUserFilePath, distUserFilePath)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
