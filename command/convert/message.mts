import { Command } from "commander"
import dotenv from "dotenv"
import pc from "picocolors"
import { writeFile, mkdir, readFile, access } from "node:fs/promises"
// TODO: 後でfsPromise.constantsを使うようにする
import { constants } from "node:fs"
import { dirname, resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { convertMessages } from "../../libs/message.mjs"
import type { User } from "../../libs/user.mjs"

const __dirname = new URL(import.meta.url).pathname
const distDirPath = resolve(__dirname, "../../../.dist/")
const distChannelFilePath = join(distDirPath, "channel.json")
const distUserFilePath = join(distDirPath, "user.json")

dotenv.config({ path: "./.envrc" })
const spinner = new Spinner()

;(async () => {
  const program = new Command()
  program.description("Convert message data command").parse(process.argv)

  // Slackのチャンネルのデータを取得する
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

  // ユーザー名を取得する
  spinner.start(pc.blue("Getting user data..."))
  let users: User[] = []
  try {
    await access(distUserFilePath, constants.R_OK)
    users = JSON.parse(await readFile(distUserFilePath, "utf8")) as User[]
  } catch (error) {
    spinner.stop(pc.blue("Getting user data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Getting user data... " + pc.green("Success")))

  // Slackのメッセージを変換する
  spinner.start(pc.blue("Converting message data..."))
  try {
    await Promise.all(
      channels.map(
        async (channel) =>
          await Promise.all(
            channel.slack.message_file_paths.map(
              async (slackMessageFilePath, index) => {
                const discordChannelFilePath =
                  channel.discord.message_file_paths[index]
                const messages = await convertMessages(
                  slackMessageFilePath,
                  users
                )
                await mkdir(dirname(discordChannelFilePath), {
                  recursive: true,
                })
                await writeFile(
                  discordChannelFilePath,
                  JSON.stringify(messages, null, 2)
                )
              }
            )
          )
      )
    )
  } catch (error) {
    spinner.stop(pc.blue("Converting message data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Converting message data... " + pc.green("Success")))

  process.exit(0)
})()
