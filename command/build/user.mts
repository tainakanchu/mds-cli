import { Command } from "commander"
import dotenv from "dotenv"
import { writeFile, mkdir, access, readFile } from "node:fs/promises"
// TODO: 後でfsPromise.constantsを使うようにする
import { constants } from "node:fs"
import { dirname, resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { buildUsers } from "../../libs/user.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { getMessageBotId, getBot } from "../../libs/bot.mjs"
import type { Bot } from "../../libs/bot.mjs"
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
    .description("Build user data command")
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
    spinner.failed(null, "Required parameter are not found")
    process.exit(0)
  }
  spinner.success()

  // チャンネルのデータを取得する
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

  // メッセージ内のBotIdを取得する
  spinner.loading("Get BotId in message")
  let botIds: string[] = []
  try {
    for (const channel of channels) {
      for (const messageFilePath of channel.slack.message_file_paths) {
        botIds = [...botIds, ...(await getMessageBotId(messageFilePath))]
      }
    }
    botIds = [...new Set(botIds)]
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success

  // Botのデータを取得する
  spinner.loading("Get bot data")
  const client = new WebClient(slackBotToken)
  let bots: Bot[] = []
  try {
    bots = await getBot(client, botIds)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success

  // ユーザーのデータを作成する
  spinner.loading("Build user data")
  try {
    const users = await buildUsers(srcUserFilePath, bots)
    await mkdir(dirname(distUserFilePath), {
      recursive: true,
    })
    await writeFile(distUserFilePath, JSON.stringify(users, null, 2))
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
