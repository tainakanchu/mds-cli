import { Command } from "commander"
import dotenv from "dotenv"
import pc from "picocolors"
import { writeFile, mkdir, readdir, readFile, access } from "node:fs/promises"
// BUG: @types/nodeにfsPromises.constantsが無いので代用
// https://github.com/nodejs/node/issues/44209
import { constants } from "node:fs"
import { dirname, resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { getChannels } from "../../libs/channel.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { getMessages } from "../../libs/message.mjs"
import type { User } from "../../libs/user.mjs"

const __dirname = new URL(import.meta.url).pathname
const slackDirPath = resolve(__dirname, "../../../.slack/")
const migrationDirPath = resolve(__dirname, "../../../.migration/")

dotenv.config({ path: "./.envrc" })
const spinner = new Spinner()

interface Options {
  discordBotToken?: string
  discordServerId?: string
  saveArchive?: boolean
}

;(async () => {
  const program = new Command()
  program
    .description("Convert slack messages file")
    .option(
      "-dt, --discord-bot-token [string]",
      "Discord Bot OAuth Token",
      process.env.DISCORD_BOT_TOKEN
    )
    .option(
      "-ds, --discord-server-id [string]",
      "Discord Server Id",
      process.env.DISCORD_SERVER_ID
    )
    .option(
      "-sa, --save-archive [boolean]",
      "Also save Slack archive channels",
      process.env.SAVE_ARCHIVE === "false" ? false : true
    )
    .parse(process.argv)

  // パラメーターの取得
  spinner.start(pc.blue("Checking parameters..."))
  const options: Options = program.opts()
  const { discordBotToken, discordServerId, saveArchive } = options
  let isFailed = false
  const errorMessages = []

  if (discordBotToken === undefined) {
    errorMessages.push("Discord Bot OAuth Token is required")
    isFailed = true
  }
  if (discordServerId === undefined) {
    errorMessages.push("Discord Server Id is required")
    isFailed = true
  }

  if (
    isFailed ||
    discordBotToken === undefined ||
    discordServerId === undefined ||
    saveArchive === undefined
  ) {
    spinner.stop(pc.blue("Checking parameters... " + pc.red("Failed")))
    console.error(pc.red(errorMessages.join("\n")))
    process.exit(0)
  }
  spinner.stop(pc.blue("Checking parameters... " + pc.green("Success")))

  // ユーザー名を取得する
  spinner.start(pc.blue("Getting user file..."))
  const usersFilePath = join(migrationDirPath, "user.json")
  let users: User[] = []
  try {
    await access(usersFilePath, constants.R_OK)
    users = JSON.parse(await readFile(usersFilePath, "utf8")) as User[]
  } catch (error) {
    spinner.stop(pc.blue("Getting user file... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Getting user file... " + pc.green("Success")))

  // Slackのチャンネル情報を取得して変換する
  spinner.start(pc.blue("Converting channel file..."))
  const slackChannelFilePath = join(slackDirPath, "channels.json")
  const newChannelFilePath = join(migrationDirPath, "channel.json")
  let channels: Channel[] = []
  try {
    channels = await getChannels(slackChannelFilePath)
    await mkdir(dirname(newChannelFilePath), {
      recursive: true,
    })
    await writeFile(newChannelFilePath, JSON.stringify(channels, null, 2))
  } catch (error) {
    spinner.stop(pc.blue("Converting channel file... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Converting channel file... " + pc.green("Success")))

  // Slackのメッセージを取得して変換する
  spinner.start(pc.blue("Converting message file..."))
  try {
    // TODO: Promise.allSettledなどで並列化する
    for (const channel of channels) {
      const messageDir = await readdir(
        join(slackDirPath, channel.slack.channel_name)
      )
      for (const messageFileName of messageDir) {
        const messageFilePath = join(
          slackDirPath,
          channel.slack.channel_name,
          messageFileName
        )
        const newMessageFilePath = join(
          migrationDirPath,
          "message",
          channel.slack.channel_name,
          messageFileName
        )
        const messages = await getMessages(messageFilePath, users)
        await mkdir(dirname(newMessageFilePath), {
          recursive: true,
        })
        await writeFile(newMessageFilePath, JSON.stringify(messages, null, 2))
      }
    }
  } catch (error) {
    spinner.stop(pc.blue("Converting message file... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Converting message file... " + pc.green("Success")))

  // Discordのチャンネルを作成
  // let discordChannels: DiscordChannel[] = []
  // try {
  //   spinner.start(pc.blue("Creating Discord Channels..."))
  //   discordChannels = await createDiscordChannels(
  //     discordBotToken,
  //     discordServerId,
  //     channels,
  //     saveArchive
  //   )
  //   spinner.stop(pc.blue("Creating Discord Channels... " + pc.green("Success")))
  // } catch (error) {
  //   spinner.stop(pc.blue("Creating Discord Channels... " + pc.red("Failed")))
  //   console.error(error)
  //   process.exit(0)
  // }

  // console.log(discordChannels)

  // for (const channel of discordChannels) {
  //   // await getMessages(slackToken, channel.slackChannelId)
  //   const messages = await getMessages(slackToken, channel.slackChannelId)
  //   console.log(JSON.stringify(messages, null, 2))
  // }

  process.exit(0)
})()
