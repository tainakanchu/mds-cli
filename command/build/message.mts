import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import type { WebClient as SlackClientType } from "@slack/web-api"
import { Spinner } from "../../libs/util/spinner.mjs"
import { getChannelFile } from "../../libs/channel.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { buildAllMessageFile } from "../../libs/message.mjs"
import { getUserFile } from "../../libs/user.mjs"
import type { User } from "../../libs/user.mjs"
import { createSlackClient } from "../../libs/client.mjs"

const __dirname = new URL(import.meta.url).pathname
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
    .description("Build message file command")
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

  // ユーザーを取得する
  spinner.loading("Get user")
  let users: User[] | null = null
  try {
    users = await getUserFile(distUserFilePath)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // メッセージファイルを作成する
  spinner.loading("Build message file")
  let isMaxFileSizeOver = false
  try {
    const buildAllMessageFileResult = await buildAllMessageFile(
      slackClient,
      channels,
      users
    )
    if (buildAllMessageFileResult.isMaxFileSizeOver) isMaxFileSizeOver = true
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
