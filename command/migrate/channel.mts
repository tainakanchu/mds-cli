import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { ChannelClient } from "../../libs/channel.mjs"

const __dirname = new URL(import.meta.url).pathname
const srcDirPath = resolve(__dirname, "../../../.src/")
const channelFilePath = join(srcDirPath, "channels.json")

dotenv.config({ path: "./.env" })
const spinner = new Spinner()

;(async () => {
  const program = new Command()
  program.description("Migrate channel command").parse(process.argv)

  spinner.loading("Create client")
  let channelClient: ChannelClient | undefined = undefined
  try {
    channelClient = new ChannelClient()
  } catch (error) {
    spinner.failed(null, error)
    process.exit(1)
  }
  spinner.success()

  spinner.loading("Migrate channel")
  try {
    await channelClient.migrateChannel(channelFilePath)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(1)
  }
  spinner.success()

  process.exit(0)
})()
