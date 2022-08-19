import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { buildChannelFile } from "../../libs/channel.mjs"

const __dirname = new URL(import.meta.url).pathname
const srcDirPath = resolve(__dirname, "../../../.src/")
const srcChannelFilePath = join(srcDirPath, "channels.json")
const srcMessageDirPath = srcDirPath
const distDirPath = resolve(__dirname, "../../../.dist/")
const distChannelFilePath = join(distDirPath, "channel.json")
const distMessageDirPath = join(distDirPath, "message")

dotenv.config({ path: "./.env" })
const spinner = new Spinner()

interface Options {
  migrateArchive?: boolean
}

;(async () => {
  const program = new Command()
  program
    .description("Build channel file command")
    .requiredOption(
      "-ma, --migrate-archive [boolean]",
      "Whether to migrate archive channel",
      process.env.MIGRATE_ARCHIVE === "true" ? true : false
    )
    .parse(process.argv)

  // パラメーターの取得
  spinner.loading("Check parameter")
  const options: Options = program.opts()
  const { migrateArchive } = options
  if (migrateArchive === undefined) {
    spinner.failed(null, "Required parameter is not found")
    process.exit(0)
  }
  spinner.success()

  // チャンネルファイルを作成する
  spinner.loading("Build channel file")
  try {
    await buildChannelFile(
      srcChannelFilePath,
      distChannelFilePath,
      srcMessageDirPath,
      distMessageDirPath,
      migrateArchive
    )
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
