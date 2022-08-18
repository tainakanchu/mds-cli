import { access, readFile, writeFile, mkdir, constants } from "node:fs/promises"
import { dirname } from "node:path"
import { Member as SlackUser } from "@slack/web-api/dist/response/UsersListResponse"
import type { Bot } from "./bot.mjs"

export interface User {
  slack: {
    id: string
    name: string
    deleted: boolean
    color: string | "808080"
    image_url: string
    is_bot: boolean
    bot?: {
      bot_id: string
      app_id: string
    }
  }
  discord: {
    id: string
    name: string
  }
}

/**
 * Get user
 * @param distUserFilePath
 */
export const getUserFile = async (
  distUserFilePath: string
): Promise<{
  users: User[]
  status: "success" | "failed"
  message?: any
}> => {
  try {
    await access(distUserFilePath, constants.R_OK)
    const users = JSON.parse(await readFile(distUserFilePath, "utf8")) as User[]
    return { users: users, status: "success" }
  } catch (error) {
    return { users: [], status: "failed", message: error }
  }
}

/**
 * Build user
 * @param srcUserFilePath
 * @param distUserFilePath
 * @param bots
 */
export const buildUser = async (
  srcUserFilePath: string,
  distUserFilePath: string,
  bots: Bot[]
): Promise<{ users: User[]; status: "success" | "failed"; message?: any }> => {
  try {
    await access(srcUserFilePath, constants.R_OK)
    const usersFile = await readFile(srcUserFilePath, "utf8")
    const users = JSON.parse(usersFile)
      .map((user: SlackUser) => {
        // Botの場合はBot情報を取得
        let botInfo: User["slack"]["bot"] = undefined
        if (user.is_bot) {
          const appId = user.profile?.api_app_id || ""
          const botId =
            bots.find((bot) => bot.app_id === appId)?.id ||
            user.profile?.bot_id ||
            ""
          botInfo = { bot_id: botId, app_id: appId }
        }

        // ユーザー名もしくはBot名を取得
        const name = user.is_bot
          ? user.real_name || ""
          : user.profile?.display_name || ""

        return {
          slack: {
            id: user.id || "",
            name: name,
            deleted: user.deleted || false,
            is_bot: user.is_bot || false,
            color: user.color || "808080",
            image_url: user.profile?.image_512 || "",
            bot: botInfo,
          },
          discord: {
            id: "",
            name: name,
          },
        } as User
      })
      .sort((user: User) => !user.slack.is_bot || !user.slack.deleted)

    await mkdir(dirname(distUserFilePath), {
      recursive: true,
    })
    await writeFile(distUserFilePath, JSON.stringify(users, null, 2))

    return { users: users, status: "success" }
  } catch (error) {
    return { users: [], status: "failed", message: error }
  }
}
