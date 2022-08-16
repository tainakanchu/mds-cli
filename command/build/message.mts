import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { getChannelFile } from "../../libs/channel.mjs"
import { buildAllMessageFile } from "../../libs/message.mjs"
import { getUserFile } from "../../libs/user.mjs"

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

  // チャンネルを取得する
  spinner.loading("Get channel")
  const { channels, ...getChannelFileResult } = await getChannelFile(
    distChannelFilePath
  )
  if (getChannelFileResult.status === "failed") {
    spinner.failed(null, getChannelFileResult.message)
    process.exit(0)
  }
  spinner.success()

  // ユーザーを取得する
  spinner.loading("Get user")
  const { users, ...getUserFileResult } = await getUserFile(distUserFilePath)
  if (getUserFileResult.status === "failed") {
    spinner.failed(null, getUserFileResult.message)
    process.exit(0)
  }
  spinner.success()

  // メッセージファイルを作成する
  spinner.loading("Build message file")
  const buildAllMessageFileResult = await buildAllMessageFile(
    channels,
    users,
    showCutLine
  )
  if (buildAllMessageFileResult.status === "failed") {
    spinner.failed(null, buildAllMessageFileResult.message)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
