import { Command } from "commander"
import dotenv from "dotenv"
import pc from "picocolors"
import { writeFile, mkdir, readdir } from "node:fs/promises"
import { dirname, resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { getSlackChannels } from "../../libs/slack/channel.mjs"
import type { SlackChannel } from "../../libs/slack/channel.mjs"
import { getSlackMessages } from "../../libs/slack/message.mjs"
import { getUsers } from "../../libs/common/user.mjs"
import type { User } from "../../libs/common/user.mjs"

const __dirname = new URL(import.meta.url).pathname
const slackDirPath = resolve(__dirname, "../../../.slack/")
const migrationDirPath = resolve(__dirname, "../../../.migration/")

dotenv.config({ path: "./.envrc" })
const spinner = new Spinner()

interface Options {
  discordToken?: string
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
  spinner.start(pc.blue("Parameter checking..."))
  const options: Options = program.opts()
  const { discordToken, discordServerId, saveArchive } = options
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

  if (
    isFailed ||
    discordToken === undefined ||
    discordServerId === undefined ||
    saveArchive === undefined
  ) {
    spinner.stop(pc.blue("Parameter checking... " + pc.red("Failed")))
    console.error(pc.red(errorMessages.join("\n")))
    process.exit(0)
  }
  spinner.stop(pc.blue("Parameter checking... " + pc.green("Success")))

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
  const newSlackUsersFilePath = join(migrationDirPath, "slack/user.json")
  let users: User[] = []
  try {
    users = await getUsers(slackUsersFilePath)
    await mkdir(dirname(newSlackUsersFilePath), {
      recursive: true,
    })
    await writeFile(newSlackUsersFilePath, JSON.stringify(users, null, 2))
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
          "slack/message",
          channel.name,
          messageFileName
        )
        const slackMessages = await getSlackMessages(messageFilePath, users)
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
