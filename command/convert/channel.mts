import { Command } from "commander"
import dotenv from "dotenv"
import pc from "picocolors"
import { writeFile, mkdir } from "node:fs/promises"
import { dirname, resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { convertChannels } from "../../libs/channel.mjs"
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
  program.description("Convert channel file").parse(process.argv)

  // Slackのチャンネル情報を変換する
  spinner.start(pc.blue("Converting channel data..."))
  let newChannels: Channel[] = []
  try {
    newChannels = await convertChannels(
      srcChannelFilePath,
      srcMessageDirPath,
      distMessageDirPath
    )
    await mkdir(dirname(distChannelFilePath), {
      recursive: true,
    })
    await writeFile(distChannelFilePath, JSON.stringify(newChannels, null, 2))
  } catch (error) {
    spinner.stop(pc.blue("Converting channel data... " + pc.red("Failed")))
    console.error(error)
    process.exit(0)
  }
  spinner.stop(pc.blue("Converting channel data... " + pc.green("Success")))

  process.exit(0)
})()
