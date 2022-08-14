import { Command } from "commander"
import dotenv from "dotenv"
import pc from "picocolors"
import { writeFile, mkdir, readdir, readFile, access } from "node:fs/promises"
// TODO: 後でfsPromise.constantsを使うようにする
import { constants } from "node:fs"
import { dirname, resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { convertMessages } from "../../libs/message.mjs"
import type { User } from "../../libs/user.mjs"

const __dirname = new URL(import.meta.url).pathname
const migrationDirPath = resolve(__dirname, "../../../.migration/")
const slackDirPath = resolve(__dirname, "../../../.slack/")
const channelFilePath = join(migrationDirPath, "channel.json")

dotenv.config({ path: "./.envrc" })
const spinner = new Spinner()

;(async () => {
  const program = new Command()
  program.description("Convert message data").parse(process.argv)

  // ユーザー名を取得する
  spinner.start(pc.blue("Getting user data..."))
  const userFilePath = join(migrationDirPath, "user.json")
  let users: User[] = []
  try {
    await access(userFilePath, constants.R_OK)
    users = JSON.parse(await readFile(userFilePath, "utf8")) as User[]
  } catch (error) {
    spinner.stop(pc.blue("Getting user data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Getting user data... " + pc.green("Success")))

  // Slackのチャンネルのデータを取得する
  spinner.start(pc.blue("Getting channel data..."))
  let channels: Channel[] = []
  try {
    await access(channelFilePath, constants.R_OK)
    channels = JSON.parse(await readFile(channelFilePath, "utf8")) as Channel[]
  } catch (error) {
    spinner.stop(pc.blue("Getting channel data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Getting channel data... " + pc.green("Success")))

  // Slackのメッセージを変換する
  spinner.start(pc.blue("Converting message data..."))
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
        const messages = await convertMessages(messageFilePath, users)
        await mkdir(dirname(newMessageFilePath), {
          recursive: true,
        })
        await writeFile(newMessageFilePath, JSON.stringify(messages, null, 2))
      }
    }
  } catch (error) {
    spinner.stop(pc.blue("Converting message data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Converting message data... " + pc.green("Success")))

  process.exit(0)
})()
