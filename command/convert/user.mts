import { Command } from "commander"
import pc from "picocolors"
import { writeFile, mkdir } from "node:fs/promises"
import { dirname, resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { getUsers } from "../../libs/common/user.mjs"
import type { User } from "../../libs/common/user.mjs"

const __dirname = new URL(import.meta.url).pathname
const slackDirPath = resolve(__dirname, "../../../.slack/")
const migrationDirPath = resolve(__dirname, "../../../.migration/")

const spinner = new Spinner()

;(async () => {
  const program = new Command()
  program.description("Convert slack users file").parse(process.argv)

  // Slackのユーザー名を取得して変換する
  spinner.start(pc.blue("Converting slack users file..."))
  const slackUsersFilePath = join(slackDirPath, "users.json")
  const newSlackUsersFilePath = join(migrationDirPath, "user.json")
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

  process.exit(0)
})()
