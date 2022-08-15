import { Command } from "commander"
import dotenv from "dotenv"
import { writeFile, mkdir } from "node:fs/promises"
import { dirname, resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { getChannelFile } from "../../libs/channel.mjs"
import type { Channel } from "../../libs/channel.mjs"
import { buildMessageFile } from "../../libs/message.mjs"
import { getUserFile } from "../../libs/user.mjs"
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
    .description("Build message file command")
    .requiredOption(
      "-sc, --show-cut-line [boolean]",
      "Whether to show cut line between message",
      process.env.SHOW_CUT_LINE === "true" ? true : false
    )
    .parse(process.argv)

  // パラメーターの取得
  spinner.loading("Check parameter")
  const options: Options = program.opts()
  const { showCutLine } = options
  if (showCutLine === undefined) {
    spinner.failed(null, "Required parameter is not found")
    process.exit(0)
  }
  spinner.success()

  // チャンネルファイルを取得する
  spinner.loading("Get channel file")
  let channels: Channel[] = []
  try {
    channels = await getChannelFile(distChannelFilePath)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // ユーザーファイルを取得する
  spinner.loading("Get user file")
  let users: User[] = []
  try {
    users = await getUserFile(distUserFilePath)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  // メッセージファイルを作成する
  spinner.loading("Build message file")
  try {
    await Promise.all(
      channels.map(
        async (channel) =>
          await Promise.all(
            channel.slack.message_file_paths.map(
              async (slackMessageFilePath, index) => {
                const discordChannelFilePath =
                  channel.discord.message_file_paths[index]
                const messages = await buildMessageFile(
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
