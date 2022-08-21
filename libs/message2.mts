import { PrismaClient, DiscordMessage } from "@prisma/client"
import { access, readFile, constants, readdir } from "node:fs/promises"
import { statSync } from "node:fs"
import { dirname, join } from "node:path"
import { v4 as uuidv4 } from "uuid"
import { WebClient as SlackClient } from "@slack/web-api"
import type { Guild as DiscordClient } from "discord.js"
import { ChannelClient } from "./channel2.mjs"
import { UserClient } from "./user2.mjs"

interface SlackMessageFile {
  type?: "message"
  subtype?: string | "bot_message"
  text?: string
  ts?: string
  user?: string
  bot_id?: string
  app_id?: string
}

export class MessageClient {
  client: PrismaClient
  constructor(client = new PrismaClient()) {
    this.client = client
  }

  /**
   * Migrate all message data
   * @param slackClient
   * @param srcDirpath
   */
  async migrateAllMessage(slackClient: SlackClient, srcDirpath: string) {
    const channelClient = new ChannelClient(this.client)
    const userClient = new UserClient(this.client)

    // Get all slack channel data
    const slackChannels = await channelClient.getAllSlackChannel()

    for (const slackChannel of slackChannels) {
      // Get slack message file paths
      const messageDirPath = join(srcDirpath, slackChannel.name)
      const messageFilePaths = await this.getAllSlackMessageFilePath(
        messageDirPath
      )

      for (const messageFilePath of messageFilePaths) {
        // Get slack message file
        const slackMessages = await this.getSlackMessageFile(messageFilePath)

        const discordMessages: DiscordMessage[] = []
        for (const slackMessage of slackMessages) {
          if (
            slackMessage.type === undefined ||
            slackMessage.text === undefined ||
            slackMessage.ts === undefined
          ) {
            throw new Error("Message is missing required parameter")
          }

          // Convert slack message content
          const content = await this.convertSlackMessageContent(
            userClient,
            slackMessage.text
          )

          // Get if message is pinned item
          const pinIds = slackChannel.pins ? slackChannel.pins.split(",") : []
          const isPinned = pinIds.includes(slackMessage.ts)

          // TODO: Message type
          let messageType = 1

          // Get message author
          const authorId = slackMessage.bot_id
            ? slackMessage.app_id
            : slackMessage.user
          if (!authorId) throw new Error(`Failed to get message author id`)
          const author =
            slackMessage.bot_id && slackMessage.app_id
              ? await userClient.getSlackBot(
                  slackClient,
                  slackMessage.bot_id,
                  slackMessage.app_id
                )
              : await userClient.getSlackUser(authorId)
          if (!author)
            throw new Error(`Failed to get message author of ${authorId}`)

          discordMessages.push({
            id: 0,
            messageId: uuidv4(),
            channelId: slackChannel.channelId,
            content: content,
            type: messageType,
            isPinned: isPinned,
            timestamp: slackMessage.ts,
            authorId: author.userId,
            authorName: author.name,
            authorImageUrl: author.imageUrl,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }

        // Update many discord message
        await this.updateManyDiscordMessage(discordMessages)
      }
    }
  }

  /**
   * Get slack message file
   * @param messageFilePath
   */
  async getSlackMessageFile(messageFilePath: string) {
    await access(messageFilePath, constants.R_OK)
    return JSON.parse(
      await readFile(messageFilePath, "utf8")
    ) as SlackMessageFile[]
  }

  /**
   * Get all slack message file path
   * @param messageDirPath
   */
  async getAllSlackMessageFilePath(messageDirPath: string) {
    const fileOrDirNames = await readdir(join(messageDirPath))
    const messageFilePaths = fileOrDirNames
      .filter(
        (fileOrDirName) =>
          // TODO: Replace with async function
          statSync(join(messageDirPath, fileOrDirName)).isFile() &&
          new RegExp(
            /[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]).json/g
          ).test(fileOrDirName)
      )
      .map((fileOrDirName) => join(messageDirPath, fileOrDirName))
    return messageFilePaths
  }

  /**
   * Convert slack message content
   * @param userClient
   * @param content
   */
  async convertSlackMessageContent(userClient: UserClient, content: string) {
    let newContent = content

    // Replace mention
    const matchMention = newContent.match(/<@U[A-Z0-9]{10}>/g)
    if (matchMention?.length) {
      const userIds = matchMention.map((mention) =>
        mention.replace(/<@|>/g, "")
      )
      for (const userId of userIds) {
        const username = await userClient.getSlackUsername(userId)
        if (username) {
          newContent = newContent.replaceAll(`<@${userId}>`, `@${username}`)
        } else {
          throw new Error(`Failed to replace mention of @${userId} to username`)
        }
      }
    }

    // Replace channel mention
    if (/<!channel>/.test(newContent))
      newContent = newContent.replaceAll(/<!channel>/g, "@channel")

    // Replace bold letters
    if (/\*.*\*/.test(newContent))
      newContent = newContent.replaceAll(/\**\*/g, "**")

    //  Replace italic letters
    // if (/\_.*\_/.test(newContent))
    //   newContent = newContent.replaceAll(/\_*\_/g, "_")

    // Replace strikethrough
    if (/~.*~/.test(newContent))
      newContent = newContent.replaceAll(/~*~/g, "~~")

    // Replace quote
    if (/&gt; .*/.test(newContent))
      newContent = newContent.replaceAll(/&gt; /g, "> ")

    // Replace URL
    if (/<http|https:\/\/.*\|.*>/.test(newContent))
      newContent = content.replaceAll(/<|\|.*>/g, "")

    return newContent
  }

  /**
   * Update many dicord message
   * @param messages
   */
  async updateManyDiscordMessage(messages: DiscordMessage[]) {
    const query = messages.map((message) =>
      this.client.discordMessage.upsert({
        where: {
          messageId: message.messageId,
        },
        update: {
          messageId: message.messageId,
          channelId: message.channelId,
          content: message.content,
          type: message.type,
          isPinned: message.isPinned,
          timestamp: message.timestamp,
          authorId: message.authorId,
          authorName: message.authorName,
          authorImageUrl: message.authorImageUrl,
        },
        create: {
          messageId: message.messageId,
          channelId: message.channelId,
          content: message.content,
          type: message.type,
          isPinned: message.isPinned,
          timestamp: message.timestamp,
          authorId: message.authorId,
          authorName: message.authorName,
          authorImageUrl: message.authorImageUrl,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        },
      })
    )
    await this.client.$transaction([...query])
  }
}
