import { Command } from "commander"
import dotenv from "dotenv"
import { getSlackChannels } from "../libs/slack/channel.mjs"
import type { SlackChannel } from "../libs/slack/channel.mjs"
import { getSlackMessages } from "../libs/slack/message.mjs"
import { getSlackUsers } from "../libs/slack/user.mjs"
import type { SlackUser } from "../libs/slack/user.mjs"
import { Spinner } from "../libs/util/spinner.mjs"
import pc from "picocolors"
import { writeFile, mkdir, readdir, rm } from "node:fs/promises"
import { dirname, resolve, join } from "node:path"

const __dirname = new URL(import.meta.url).pathname
const slackDirPath = resolve(__dirname, "../../.slack/")
const migrationDirPath = resolve(__dirname, "../../.migrations/")

dotenv.config({ path: "./.envrc" })
const spinner = new Spinner()

interface Options {
  discordToken?: string
  discordServerId?: string
  slackToken?: string
  saveArchive?: boolean
}

;(async () => {
  const program = new Command()

  program
    .description("App to transfer from slack to discord")
    .option(
      "-dt, --discord-token [string]",
      "Discord Bot OAuth Token",
      process.env.DISCORD_TOKEN
    )
    .option(
      "-ds, --discord-server-id [string]",
      "Discord Server Id",
      process.env.DISCORD_SERVER_ID
    )
    .option(
      "-st, --slack-token [string]",
      "Slack Bot OAuth Token",
      process.env.SLACK_TOKEN
    )
    .option(
      "-sa, --save-archive [boolean]",
      "Also save Slack archive channels",
      process.env.SAVE_ARCHIVE === "false" ? false : true
    )
    .parse(process.argv)

  // パラメーターの取得
  spinner.start(pc.blue("Parameter checking..."))
  const options: Options = program.opts()
  const { discordToken, discordServerId, slackToken, saveArchive } = options
  let isFailed = false
  const errorMessages = []

  if (discordToken === undefined) {
    errorMessages.push("Discord Bot OAuth Token is required")
    isFailed = true
  }
  if (discordServerId === undefined) {
    errorMessages.push("Discord Server Id is required")
    isFailed = true
  }
  if (slackToken === undefined) {
    errorMessages.push("Slack Bot OAuth Token Id is required")
    isFailed = true
  }

  if (
    isFailed ||
    discordToken === undefined ||
    discordServerId === undefined ||
    slackToken === undefined ||
    saveArchive === undefined
  ) {
    spinner.stop(pc.blue("Parameter checking... " + pc.red("Failed")))
    console.error(pc.red(errorMessages.join("\n")))
    process.exit(0)
  }
  spinner.stop(pc.blue("Parameter checking... " + pc.green("Success")))

  // ディレクトリ初期化
  spinner.start(pc.blue("Initializing working directory..."))
  try {
    await rm(migrationDirPath, { recursive: true })
    await mkdir(dirname(migrationDirPath), {
      recursive: true,
    })
  } catch (error) {
    spinner.stop(
      pc.blue("Initializing working directory... " + pc.red("Failed"))
    )
    console.error(error)
    process.exit(0)
  }
  spinner.stop(
    pc.blue("Initializing working directory... " + pc.green("Success"))
  )

  // Slackのチャンネル情報を取得して変換する
  spinner.start(pc.blue("Converting slack channels file..."))
  const slackChannelsFilePath = join(slackDirPath, "channels.json")
  const newSlackChannelsFilePath = join(migrationDirPath, "slack/channels.json")
  let slackChannels: SlackChannel[] = []
  try {
    slackChannels = await getSlackChannels(slackChannelsFilePath)
    await mkdir(dirname(newSlackChannelsFilePath), {
      recursive: true,
    })
    await writeFile(
      newSlackChannelsFilePath,
      JSON.stringify(slackChannels, null, 2)
    )
  } catch (error) {
    spinner.stop(
      pc.blue("Converting slack channels file... " + pc.red("Failed"))
    )
    console.error(error)
    process.exit(0)
  }
  spinner.stop(
    pc.blue("Converting slack channels file... " + pc.green("Success"))
  )

  // Slackのユーザー名を取得して変換する
  spinner.start(pc.blue("Converting slack users file..."))
  const slackUsersFilePath = join(slackDirPath, "users.json")
  const newSlackUsersFilePath = join(migrationDirPath, "slack/users.json")
  let slackUsers: SlackUser[] = []
  try {
    slackUsers = await getSlackUsers(slackUsersFilePath)
    await mkdir(dirname(newSlackUsersFilePath), {
      recursive: true,
    })
    await writeFile(newSlackUsersFilePath, JSON.stringify(slackUsers, null, 2))
  } catch (error) {
    spinner.stop(pc.blue("Converting slack users file... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Converting slack users file... " + pc.green("Success")))

  // Slackのメッセージのjsonファイルを取得して変換する
  spinner.start(pc.blue("Converting slack message files..."))
  try {
    // TODO: Promise.allSettledなどで並列化する
    for (const channel of slackChannels) {
      const messageDir = await readdir(join(slackDirPath, channel.name))
      for (const messageFileName of messageDir) {
        const messageFilePath = join(
          slackDirPath,
          channel.name,
          messageFileName
        )
        const newMessageFilePath = join(
          migrationDirPath,
          "slack/messages",
          channel.name,
          messageFileName
        )
        const slackMessages = await getSlackMessages(
          messageFilePath,
          slackUsers
        )
        await mkdir(dirname(newMessageFilePath), {
          recursive: true,
        })
        await writeFile(
          newMessageFilePath,
          JSON.stringify(slackMessages, null, 2)
        )
      }
    }
  } catch (error) {
    spinner.stop(
      pc.blue("Converting slack message files... " + pc.red("Failed"))
    )
    console.error(error)
    process.exit(0)
  }
  spinner.stop(
    pc.blue("Converting slack message files... " + pc.green("Success"))
  )

  // Discordのチャンネルを作成
  // let discordChannels: DiscordChannel[] = []
  // try {
  //   spinner.start(pc.blue("Creating Discord Channels..."))
  //   discordChannels = await createDiscordChannels(
  //     discordToken,
  //     discordServerId,
  //     slackChannels,
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
  //   // await getSlackMessages(slackToken, channel.slackChannelId)
  //   const messages = await getSlackMessages(slackToken, channel.slackChannelId)
  //   console.log(JSON.stringify(messages, null, 2))
  // }

  process.exit(0)
})()
