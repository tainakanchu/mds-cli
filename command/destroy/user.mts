import { Command } from "commander"
import dotenv from "dotenv"
import type { Guild as DiscordClient } from "discord.js"
import prompts from "prompts"
import { Spinner } from "../../libs/util/spinner.mjs"
import { createDiscordClient } from "../../libs/client.mjs"
import { UserClient } from "../../libs/user.mjs"

dotenv.config({ path: "./.env" })
const spinner = new Spinner()

interface Options {
  discordBotToken?: string
  discordServerId?: string
}

;(async () => {
  const confirm = await prompts({
    type: "confirm",
    name: "value",
    message: "Destroy channel for hosting user image?",
  })
  if (!confirm.value) process.exit(0)

  const program = new Command()
  program
    .description("Destroy channel for hosting user image command")
    .requiredOption(
      "-dt, --discord-bot-token [string]",
      "DiscordBot OAuth Token",
      process.env.DISCORD_BOT_TOKEN
    )
    .requiredOption(
      "-ds, --discord-server-id [string]",
      "Discord Server ID",
      process.env.DISCORD_SERVER_ID
    )
    .parse(process.argv)

  spinner.loading("Check parameter")
  const options: Options = program.opts()
  const { discordBotToken, discordServerId } = options
  if (discordBotToken === undefined || discordServerId === undefined) {
    spinner.failed(null, "Required parameter is not found")
    process.exit(1)
  }
  spinner.success()

  spinner.loading("Create client")
  let userClient: UserClient | undefined = undefined
  let discordClient: DiscordClient | undefined = undefined
  try {
    userClient = new UserClient()
    discordClient = await createDiscordClient(discordBotToken, discordServerId)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(1)
  }
  spinner.success()

  spinner.loading("Destroy channel for hosting user image")
  try {
    await userClient.destroyUserImageChannel(discordClient)
  } catch (error) {
    spinner.failed(null, error)
    process.exit(1)
  }
  spinner.success()

  process.exit(0)
})()
