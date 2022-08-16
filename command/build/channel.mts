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

dotenv.config({ path: "./.envrc" })
const spinner = new Spinner()

;(async () => {
  const program = new Command()
  program.description("Build channel file command").parse(process.argv)

  // チャンネルファイルを作成する
  spinner.loading("Build channel file")
  const buildChannelFileResult = await buildChannelFile(
    srcChannelFilePath,
    distChannelFilePath,
    srcMessageDirPath,
    distMessageDirPath
  )
  if (buildChannelFileResult.status === "failed") {
    spinner.failed(null, buildChannelFileResult.message)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
