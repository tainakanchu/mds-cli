import { Command } from "commander"
import dotenv from "dotenv"
import pc from "picocolors"
import { writeFile, mkdir, access, readFile, readdir } from "node:fs/promises"
// TODO: 後でfsPromise.constantsを使うようにする
import { constants } from "node:fs"
import { dirname, resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { convertUsers } from "../../libs/user.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { getMessageBotIds, convertBots } from "../../libs/bot.mjs"
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
    .description("Convert user data")
    .requiredOption(
      "-st, --slack-bot-token [string]",
      "SlackBot oauth token",
      process.env.SLACK_BOT_TOKEN
    )
    .parse(process.argv)

  // パラメーターの取得
  spinner.start(pc.blue("Checking parameters..."))
  const options: Options = program.opts()
  const { slackBotToken } = options
  if (slackBotToken === undefined) {
    spinner.stop(pc.blue("Checking parameters... " + pc.red("Failed")))
    console.error(pc.red("SlackBot OAuth Token is required"))
    process.exit(0)
  }
  spinner.stop(pc.blue("Checking parameters... " + pc.green("Success")))

  // チャンネルのデータを取得する
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

  // メッセージ内のBotIdを取得する
  spinner.start(pc.blue("Getting BotId in message..."))
  let botIds: string[] = []
  try {
    for (const channel of channels) {
      for (const messageFilePath of channel.slack.message_file_paths) {
        botIds = [...botIds, ...(await getMessageBotIds(messageFilePath))]
      }
    }
    botIds = [...new Set(botIds)]
  } catch (error) {
    spinner.stop(pc.blue("Getting BotId in message... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Getting BotId in message... " + pc.green("Success")))

  // Botのデータを取得して変換する
  spinner.start(pc.blue("Converting bot data..."))
  const client = new WebClient(slackBotToken)
  let bots: Bot[] = []
  try {
    bots = await convertBots(client, botIds)
  } catch (error) {
    spinner.stop(pc.blue("Converting bot data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Converting bot data... " + pc.green("Success")))

  // ユーザーのデータを取得して変換する
  spinner.start(pc.blue("Converting user data..."))
  try {
    const users = await convertUsers(srcUserFilePath, bots)
    await mkdir(dirname(distUserFilePath), {
      recursive: true,
    })
    await writeFile(distUserFilePath, JSON.stringify(users, null, 2))
  } catch (error) {
    spinner.stop(pc.blue("Converting user data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Converting user data... " + pc.green("Success")))

  process.exit(0)
})()
