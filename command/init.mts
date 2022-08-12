import { Command } from "commander"
import pc from "picocolors"
import { mkdir, rm } from "node:fs/promises"
import { resolve } from "node:path"
import { Spinner } from "../libs/util/spinner.mjs"

const __dirname = new URL(import.meta.url).pathname
const migrationDirPath = resolve(__dirname, "../../.migration/")

const spinner = new Spinner()

;(async () => {
  const program = new Command()
  program
    .description("Initial process for migrating from slack to discord")
    .parse(process.argv)

  // 作業ディレクトリ初期化
  spinner.start(pc.blue("Initializing working directory..."))
  try {
    await rm(migrationDirPath, { recursive: true, force: true })
    await mkdir(migrationDirPath, {
      recursive: true,
    })
  } catch (error) {
    spinner.stop(
      pc.blue("Initializing working directory... " + pc.red("Failed"))
    )
    console.error(error)
    process.exit(0)
  }
  spinner.stop(
    pc.blue("Initializing working directory... " + pc.green("Success"))
  )

  process.exit(0)
})()
