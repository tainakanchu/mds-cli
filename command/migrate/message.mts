import { Command } from "commander"
import dotenv from "dotenv"
import { resolve } from "node:path"
import type { WebClient as SlackClient } from "@slack/web-api"
import { Spinner } from "../../libs/util/spinner.mjs"
import { MessageClient } from "../../libs/message.mjs"
import { createSlackClient } from "../../libs/client.mjs"

const __dirname = new URL(import.meta.url).pathname
const srcDirPath = resolve(__dirname, "../../../.src/")

dotenv.config({ path: "./.env" })
const spinner = new Spinner()

interface Options {
  slackBotToken?: string
}

;(async () => {
  const program = new Command()
  program
    .description("Migrate message command")
    .requiredOption(
      "-st, --slack-bot-token [string]",
      "SlackBot OAuth Token",
      process.env.SLACK_BOT_TOKEN
    )
    .parse(process.argv)

  spinner.loading("Check parameter")
  const options: Options = program.opts()
  const { slackBotToken } = options
  if (slackBotToken === undefined) {
    spinner.failed(null, "Required parameter is not found")
    process.exit(0)
  }
  spinner.success()

  spinner.loading("Create client")
  let messageClient: MessageClient | undefined = undefined
  let slackClient: SlackClient | undefined = undefined
  try {
    messageClient = new MessageClient()
    slackClient = createSlackClient(slackBotToken)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(1)
  }
  spinner.success()

  spinner.loading("Migrate message")
  try {
    await messageClient.migrateAllMessage(slackClient, srcDirPath)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(1)
  }
  spinner.success()

  process.exit(0)
})()
