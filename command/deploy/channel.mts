import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import { createDiscordGuild } from "../../libs/client.mjs"
import {
  createChannel,
  getChannelFile,
  createChannelFile,
} from "../../libs/channel.mjs"
import { createCategory, createCategoryFile } from "../../libs/category.mjs"

const __dirname = new URL(import.meta.url).pathname
const distDirPath = resolve(__dirname, "../../../.dist/")
const distCategoryFilePath = join(distDirPath, "category.json")
const distChannelFilePath = join(distDirPath, "channel.json")

dotenv.config({ path: "./.envrc" })
const spinner = new Spinner()

interface Options {
  discordBotToken?: string
  discordServerId?: string
  migrateArchive?: boolean
}

;(async () => {
  const program = new Command()
  program
    .description("Deploy channel command")
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
    .requiredOption(
      "-ma, --migrate-archive [boolean]",
      "Whether to migrate archive channel",
      process.env.MIGRATE_ARCHIVE === "true" ? true : false
    )
    .parse(process.argv)

  // パラメーターの取得
  spinner.loading("Check parameter")
  const options: Options = program.opts()
  const { discordBotToken, discordServerId, migrateArchive } = options
  if (
    discordBotToken === undefined ||
    discordServerId === undefined ||
    migrateArchive === undefined
  ) {
    spinner.failed(null, "Required parameter is not found")
    process.exit(0)
  }
  spinner.success()

  // Discordのギルドを作成する
  spinner.loading("Create discord guild")
  const { discordGuild, ...createDiscordGuildResult } =
    await createDiscordGuild(discordBotToken, discordServerId)
  if (!discordGuild || createDiscordGuildResult.status === "failed") {
    spinner.failed(null, createDiscordGuildResult.message)
    process.exit(0)
  }
  spinner.success()

  // チャンネルファイルを取得する
  spinner.loading("Get channel file")
  const { channels, ...getChannelFileResult } = await getChannelFile(
    distChannelFilePath
  )
  if (getChannelFileResult.status === "failed") {
    spinner.failed(null, getChannelFileResult.message)
    process.exit(0)
  }
  spinner.success()

  // チャンネルのカテゴリーを作成する
  spinner.loading("Create category")
  const { categories, ...createCategoryResult } = await createCategory(
    discordGuild,
    [
      { id: "", name: "CHANNEL" },
      { id: "", name: "ARCHIVE" },
    ]
  )
  if (createCategoryResult.status === "failed") {
    spinner.failed(null, createCategoryResult.message)
    process.exit(0)
  }

  const defaultCategory = categories.find(
    (category) => category.name === "CHANNEL"
  )
  const archiveCategory = categories.find(
    (category) => category.name === "ARCHIVE"
  )
  if (!defaultCategory || !archiveCategory) {
    spinner.failed(null, "Failed to create category")
    process.exit(0)
  }
  spinner.success()

  // カテゴリーファイルを更新する
  spinner.loading("Update category file")
  const createCategoryFileResult = await createCategoryFile(
    distCategoryFilePath,
    categories
  )
  if (createCategoryFileResult.status === "failed") {
    spinner.failed(null, createCategoryFileResult.message)
    process.exit(0)
  }
  spinner.success()

  // チャンネルを作成する
  spinner.loading("Create channel")
  const createChannelResult = await createChannel(
    discordGuild,
    channels,
    defaultCategory,
    archiveCategory,
    migrateArchive
  )
  if (createChannelResult.status === "failed") {
    spinner.failed(null, createChannelResult.message)
    process.exit(0)
  }
  const newChannels = createChannelResult.channels
  spinner.success()

  // チャンネルファイルを更新する
  spinner.loading("Update channel file")
  const createChannelFileResult = await createChannelFile(
    distChannelFilePath,
    newChannels
  )
  if (createChannelFileResult.status === "failed") {
    spinner.failed(null, createChannelFileResult.message)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
