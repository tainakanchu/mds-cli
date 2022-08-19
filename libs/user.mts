import { access, readFile, writeFile, mkdir, constants } from "node:fs/promises"
import { dirname } from "node:path"
import { WebClient as SlackClient } from "@slack/web-api"
import { Member as SlackUser } from "@slack/web-api/dist/response/UsersListResponse"

export interface User {
  slack: {
    id: string
    name: string
    color: string | "808080"
    image_url: string
    is_bot: boolean
    is_deleted: boolean
    bot?: {
      id?: string
      app_id?: string
    }
  }
  discord: {
    id: string
    name: string
  }
}

/**
 * Get user data
 * @param slackClient
 * @param userId
 */
export const getUser = async (
  slackClient: SlackClient,
  userId: string
): Promise<User> => {
  const result = await slackClient.users.info({ user: userId })

  // ユーザーの必須項目がない場合は例外を投げる
  if (
    result.user?.id === undefined ||
    result.user?.name === undefined ||
    result.user?.color === undefined ||
    result.user?.profile?.image_512 === undefined ||
    result.user?.is_bot === undefined ||
    result.user?.deleted === undefined
  ) {
    throw new Error("User is missing a required parameter")
  }

  const bot = result.user.is_bot
    ? {
        id: result.user?.profile?.bot_id,
        app_id: result.user?.profile?.api_app_id,
      }
    : undefined

  const user: User = {
    slack: {
      id: result.user.id,
      name: result.user.name,
      color: result.user.color,
      image_url: result.user.profile?.image_512,
      is_bot: result.user.is_bot,
      is_deleted: result.user.deleted,
      bot: bot,
    },
    discord: {
      id: "",
      name: "",
    },
  }

  return user
}

/**
 * Get username
 * @param slackClient
 * @param userId
 */
export const getUsername = async (
  slackClient: SlackClient,
  userId: string
): Promise<string | null> => {
  const result = await slackClient.users.info({ user: userId })
  return result.user?.name || null
}

/**
 * Get user
 * @param distUserFilePath
 */
export const getUserFile = async (
  distUserFilePath: string
): Promise<User[]> => {
  await access(distUserFilePath, constants.R_OK)
  const users = JSON.parse(await readFile(distUserFilePath, "utf8")) as User[]
  return users
}

/**
 * Build user
 * @param srcUserFilePath
 * @param distUserFilePath
 */
export const buildUser = async (
  srcUserFilePath: string,
  distUserFilePath: string
): Promise<void> => {
  await access(srcUserFilePath, constants.R_OK)
  const usersFile = await readFile(srcUserFilePath, "utf8")
  const users = (JSON.parse(usersFile) as SlackUser[]).map((user) => {
    // ユーザーの必須項目がない場合は例外を投げる
    if (
      user.id === undefined ||
      user.profile?.real_name === undefined ||
      user.profile?.display_name === undefined ||
      user.is_bot === undefined ||
      user.deleted === undefined ||
      user.profile?.image_512 === undefined
    ) {
      throw new Error("User is missing a required parameter")
    }

    // ユーザー名もしくはBot名を取得
    const name = user.is_bot
      ? user.profile?.real_name
      : user.profile?.display_name

    // ユーザーがBotの場合はBot情報を取得
    const bot: User["slack"]["bot"] = user.is_bot
      ? { id: user.profile?.bot_id, app_id: user.profile?.api_app_id }
      : undefined

    const newUser: User = {
      slack: {
        id: user.id,
        name: name,
        is_bot: user.is_bot,
        is_deleted: user.deleted,
        color: user.color || "808080",
        image_url: user.profile.image_512,
        bot: bot,
      },
      discord: {
        id: "",
        name: name,
      },
    }

    return newUser
  })

  // ユーザーファイルを作成する
  await mkdir(dirname(distUserFilePath), {
    recursive: true,
  })
  await writeFile(distUserFilePath, JSON.stringify(users, null, 2))
}
