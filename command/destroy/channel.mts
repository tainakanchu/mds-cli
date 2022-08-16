import { Command } from "commander"
import dotenv from "dotenv"
import { resolve, join } from "node:path"
import { Spinner } from "../../libs/util/spinner.mjs"
import {
  createChannelFile,
  deleteChannel,
  getChannelFile,
} from "../../libs/channel.mjs"
import {
  createCategoryFile,
  deleteCategory,
  getCategoryFile,
} from "../../libs/category.mjs"

const __dirname = new URL(import.meta.url).pathname
const distDirPath = resolve(__dirname, "../../../.dist/")
const distCategoryFilePath = join(distDirPath, "category.json")
const distChannelFilePath = join(distDirPath, "channel.json")

dotenv.config({ path: "./.envrc" })
const spinner = new Spinner()

interface Options {
  discordBotToken?: string
  discordServerId?: string
}

;(async () => {
  const program = new Command()
  program
    .description("Delete channel command")
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

  // パラメーターの取得
  spinner.loading("Check parameter")
  const options: Options = program.opts()
  const { discordBotToken, discordServerId } = options
  if (discordBotToken === undefined || discordServerId === undefined) {
    spinner.failed(null, "Required parameter is not found")
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

  // カテゴリーファイルを取得する
  spinner.loading("Get category file")
  const { categories, ...getCategoryFileResult } = await getCategoryFile(
    distCategoryFilePath
  )
  if (getCategoryFileResult.status === "failed") {
    spinner.failed(null, getCategoryFileResult.message)
    process.exit(0)
  }
  spinner.success()

  // チャンネルを削除する
  spinner.loading("Delete channel")
  const deleteChannelResult = await deleteChannel(
    discordBotToken,
    discordServerId,
    channels
  )
  if (deleteChannelResult.status === "failed") {
    spinner.failed(null, deleteChannelResult.message)
    process.exit(0)
  }
  const newChannels = deleteChannelResult.channels
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

  // Discordのカテゴリーを削除する
  spinner.loading("Delete category")
  const deleteCategoryResult = await deleteCategory(
    discordBotToken,
    discordServerId,
    categories
  )
  if (deleteCategoryResult.status === "failed") {
    spinner.failed(null, deleteCategoryResult.message)
    process.exit(0)
  }
  const newCategories = deleteCategoryResult.categories
  spinner.success()

  // カテゴリーファイルを更新する
  spinner.loading("Update category file")
  const createCategoryFileResult = await createCategoryFile(
    distCategoryFilePath,
    newCategories
  )
  if (createCategoryFileResult.status === "failed") {
    spinner.failed(null, createCategoryFileResult.message)
    process.exit(0)
  }
  spinner.success()

  process.exit(0)
})()
