import { access, readFile } from "node:fs/promises"
// TODO: 後でfsPromise.constantsを使うようにする
import { constants } from "node:fs"
import { Member as SlackUser } from "@slack/web-api/dist/response/UsersListResponse"
import type { Bot } from "./bot.mjs"

export interface User {
  slack: {
    id: string
    name: string
    deleted: boolean
    is_bot: boolean
  }
  discord: {
    id: string
    name: string
  }
}

/**
 * Convert user
 * @param filePath
 * @returns User[]
 */
export const convertUsers = async (filePath: string, bots: Bot[]) => {
  await access(filePath, constants.R_OK)
  const usersFile = await readFile(filePath, "utf8")
  const users = JSON.parse(usersFile)
    .map((user: SlackUser) => {
      let id = user.id || ""

      if (user.is_bot) {
        const appId = user.profile?.api_app_id || ""
        const botId = bots.find((bot) => bot.app_id === appId)?.id || ""
        id = botId
      }

      const name = user.is_bot
        ? user.real_name || ""
        : user.profile?.display_name || ""

      return {
        slack: {
          id: id,
          name: name,
          deleted: user.deleted || false,
          is_bot: user.is_bot || false,
        },
        discord: {
          id: "",
          name: name,
        },
      } as User
    })
    .sort((user: User) => !user.slack.is_bot || !user.slack.deleted)
  return users
}
