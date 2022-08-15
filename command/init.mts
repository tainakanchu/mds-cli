import { Command } from "commander"
import dotenv from "dotenv"
import pc from "picocolors"
import { mkdir, rm } from "node:fs/promises"
import { resolve } from "node:path"
import { Spinner } from "../libs/util/spinner.mjs"

const __dirname = new URL(import.meta.url).pathname
const distDirPath = resolve(__dirname, "../../.dist/")

dotenv.config({ path: "./.envrc" })
const spinner = new Spinner()

;(async () => {
  const program = new Command()
  program.description("Init process command").parse(process.argv)

  // 作業ディレクトリ初期化
  spinner.start(pc.blue("Initializing working directory..."))
  try {
    await rm(distDirPath, { recursive: true, force: true })
    await mkdir(distDirPath, {
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
