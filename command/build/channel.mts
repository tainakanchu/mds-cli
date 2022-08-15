import { Command } from "commander"
import dotenv from "dotenv"
import { writeFile, mkdir } from "node:fs/promises"
import { dirname, resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { buildChannel } from "../../libs/channel.mjs"
import type { Channel } from "../../libs/channel.mjs"

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
  program.description("Build channel data command").parse(process.argv)

  // チャンネル情報を作成する
  spinner.loading("Build channel data")
  let channels: Channel[] = []
  try {
    channels = await buildChannel(
      srcChannelFilePath,
      srcMessageDirPath,
      distMessageDirPath
    )
    await mkdir(dirname(distChannelFilePath), {
      recursive: true,
    })
    await writeFile(distChannelFilePath, JSON.stringify(channels, null, 2))
  } catch (error) {
    spinner.failed(null, error)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
