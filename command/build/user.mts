import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { buildUser } from "../../libs/user.mjs"
import { getChannelFile } from "../../libs/channel.mjs"
import { getMessageBotId, getBotData } from "../../libs/bot.mjs"
import { WebClient } from "@slack/web-api"

const __dirname = new URL(import.meta.url).pathname
const srcDirPath = resolve(__dirname, "../../../.src/")
const srcUserFilePath = join(srcDirPath, "users.json")
const distDirPath = resolve(__dirname, "../../../.dist/")
const distChannelFilePath = join(distDirPath, "channel.json")
const distUserFilePath = join(distDirPath, "user.json")

dotenv.config({ path: "./.envrc" })
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

  // チャンネルファイルを取得する
  spinner.loading("Get channel file")
  const { channels, ...getChannelFileResult } = await getChannelFile(
    distChannelFilePath
  )
  if (getChannelFileResult.status === "failed") {
    spinner.failed(null, getChannelFileResult.message)
    process.exit(0)
  }
  spinner.success()

  // メッセージファイル内のBotIdを取得する
  spinner.loading("Get BotId in message file")
  const { botIds, ...getMessageBotIdResult } = await getMessageBotId(channels)
  if (getMessageBotIdResult.status === "failed") {
    spinner.failed(null, getMessageBotIdResult.message)
    process.exit(0)
  }
  spinner.success

  // Botのデータを取得する
  spinner.loading("Get bot data")
  const client = new WebClient(slackBotToken)
  const { bots, ...getBotDataResult } = await getBotData(client, botIds)
  if (getBotDataResult.status === "failed") {
    spinner.failed(null, getBotDataResult.message)
    process.exit(0)
  }
  spinner.success

  // ユーザーファイルを作成する
  spinner.loading("Build user file")
  try {
    await buildUser(srcUserFilePath, distUserFilePath, bots)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
