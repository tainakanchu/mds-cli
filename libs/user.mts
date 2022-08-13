import { access, readFile } from "node:fs/promises"
// TODO: 後でfsPromise.constantsを使うようにする
import { constants } from "node:fs"
import { Member } from "@slack/web-api/dist/response/UsersListResponse"

export interface User {
  slack: {
    user_id: string
    user_name: string
    deleted: boolean
    is_bot: boolean
  }
  discord: {
    user_id: string
    user_name: string
  }
}

/**
 * Get user infomation
 * @param filePath
 * @returns User[]
 */
export const getUsers = async (filePath: string) => {
  await access(filePath, constants.R_OK)
  const usersFile = await readFile(filePath, "utf8")
  const users = JSON.parse(usersFile).map((member: Member) => {
    const userName = member.is_bot
      ? member.name
      : member.profile?.display_name
      ? member.profile.display_name
      : ""

    return {
      slack: {
        user_id: member.id,
        user_name: userName,
        deleted: member.deleted,
        is_bot: member.is_bot,
      },
      discord: {
        user_id: "",
        user_name: userName,
      },
    }
  }) as User[]
  return users
}
