import { Command } from "commander"
import dotenv from "dotenv"
import pc from "picocolors"
import { writeFile, mkdir, readFile, access } from "node:fs/promises"
// TODO: 後でfsPromise.constantsを使うようにする
import { constants } from "node:fs"
import { dirname, resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { getChannels } from "../../libs/channel.mjs"
import type { Channel } from "../../libs/channel.mjs"
import type { User } from "../../libs/user.mjs"

const __dirname = new URL(import.meta.url).pathname
const slackDirPath = resolve(__dirname, "../../../.slack/")
const migrationDirPath = resolve(__dirname, "../../../.migration/")

dotenv.config({ path: "./.envrc" })
const spinner = new Spinner()

;(async () => {
  const program = new Command()
  program.description("Convert message file").parse(process.argv)

  // ユーザー名を取得する
  spinner.start(pc.blue("Getting user file..."))
  const userFilePath = join(migrationDirPath, "user.json")
  let users: User[] = []
  try {
    await access(userFilePath, constants.R_OK)
    users = JSON.parse(await readFile(userFilePath, "utf8")) as User[]
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

  process.exit(0)
})()
