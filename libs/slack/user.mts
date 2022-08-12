import { access, readFile } from "node:fs/promises"
// BUG: @types/nodeにfsPromises.constantsが無いので代用
// https://github.com/nodejs/node/issues/44209
import { constants } from "node:fs"
import { Member as User } from "@slack/web-api/dist/response/UsersListResponse"

export interface SlackUser {
  id: string
  name: string
  deleted: boolean
  is_bot: boolean
  timestamp: string
}

export const getSlackUsers = async (filePath: string) => {
  await access(filePath, constants.R_OK)
  const usersFile = await readFile(filePath, "utf8")
  const users = JSON.parse(usersFile).map((user: User) => ({
    id: user.id,
    name: user.is_bot
      ? user.name
      : user.profile?.display_name
      ? user.profile.display_name
      : "",
    deleted: user.deleted,
    is_bot: user.is_bot,
  })) as SlackUser[]
  return users
}
