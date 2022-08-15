import { Command } from "commander"
import dotenv from "dotenv"
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

interface Options {
  showCutLine?: boolean
}

;(async () => {
  const program = new Command()
  program
    .description("Convert message data command")
    .requiredOption(
      "-sc, --show-cut-line [boolean]",
      "Whether to show cut line between message",
      process.env.SHOW_CUT_LINE === "true" ? true : false
    )
    .parse(process.argv)

  // パラメーターの取得
  spinner.loading("Check parameters")
  const options: Options = program.opts()
  const { showCutLine } = options
  if (showCutLine === undefined) {
    spinner.failed(null, "Required parameters are not found")
    process.exit(0)
  }
  spinner.success()

  // Slackのチャンネルのデータを取得する
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

  // ユーザー名を取得する
  spinner.loading("Get user data...")
  let users: User[] = []
  try {
    await access(distUserFilePath, constants.R_OK)
    users = JSON.parse(await readFile(distUserFilePath, "utf8")) as User[]
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // Slackのメッセージを変換する
  spinner.loading("Convert message data...")
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
                  users,
                  showCutLine
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
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
