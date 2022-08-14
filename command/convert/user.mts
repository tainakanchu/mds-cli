import { Command } from "commander"
import dotenv from "dotenv"
import pc from "picocolors"
import { writeFile, mkdir } from "node:fs/promises"
import { dirname, resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { convertUsers } from "../../libs/user.mjs"

const __dirname = new URL(import.meta.url).pathname
const migrationDirPath = resolve(__dirname, "../../../.migration/")
const slackDirPath = resolve(__dirname, "../../../.slack/")
const slackUserFilePath = join(slackDirPath, "users.json")
const newUserFilePath = join(migrationDirPath, "user.json")

dotenv.config({ path: "./.envrc" })
const spinner = new Spinner()

;(async () => {
  const program = new Command()
  program.description("Convert user data").parse(process.argv)

  // Slackのユーザーのデータを変換する
  spinner.start(pc.blue("Converting user data..."))
  try {
    const users = await convertUsers(slackUserFilePath)
    await mkdir(dirname(newUserFilePath), {
      recursive: true,
    })
    await writeFile(newUserFilePath, JSON.stringify(users, null, 2))
  } catch (error) {
    spinner.stop(pc.blue("Converting user data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Converting user data... " + pc.green("Success")))

  process.exit(0)
})()
