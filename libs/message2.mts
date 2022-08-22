import { PrismaClient, DiscordMessage, SlackUser } from "@prisma/client"
import { access, readFile, constants, readdir } from "node:fs/promises"
import { statSync } from "node:fs"
import { join } from "node:path"
import { format, formatISO, fromUnixTime } from "date-fns"
import retry from "async-retry"
import { WebClient as SlackClient } from "@slack/web-api"
import { ChannelType, EmbedType } from "discord.js"
import type {
  Guild as DiscordClient,
  TextChannel,
  APIEmbed as Embed,
} from "discord.js"
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
          let author: SlackUser | null = null
          if (slackMessage.bot_id) {
            author = await userClient.getSlackBot(
              slackClient,
              slackMessage.bot_id
            )
          } else if (slackMessage.user) {
            author = await userClient.getSlackUser(
              slackClient,
              slackMessage.user
            )
          }
          if (!author) throw new Error("Failed to get message author")

          // TODO:Replace author image url

          discordMessages.push({
            id: 0,
            messageId: null,
            channelId: slackChannel.channelId,
            content: content,
            type: messageType,
            isPinned: isPinned,
            timestamp: fromUnixTime(Number(slackMessage.ts)),
            authorId: author.userId,
            authorName: author.name,
            authorType: author.type,
            authorColor: author.color,
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
   * Deploy all message
   * @param discordClient
   */
  async deployAllMessage(discordClient: DiscordClient) {
    //  Get all slack channel data
    const channelClient = new ChannelClient(this.client)
    const slackChannels = await channelClient.getAllSlackChannel()
    for (const channel of slackChannels) {
      const channelManager = discordClient.channels.cache.get(channel.channelId)
      if (
        channelManager === undefined ||
        channelManager.type !== ChannelType.GuildText
      )
        throw new Error(`Failed to get channel manager of ${channel.channelId}`)

      // Pagination message
      const take = 100
      let skip = 0
      const total = await this.client.discordMessage.count({
        where: {
          channelId: channel.channelId,
        },
      })
      while (skip < total) {
        const messages = await this.client.discordMessage.findMany({
          take: take,
          skip: skip,
          where: {
            channelId: channel.channelId,
          },
          orderBy: {
            timestamp: "asc",
          },
        })

        // Deploy many message
        await this.deployManyMessage(channelManager, messages)

        skip += take
      }
    }
  }

  /**
   * Deploy many message
   * @param channelManager
   * @param messages
   */
  async deployManyMessage(
    channelManager: TextChannel,
    messages: DiscordMessage[]
  ) {
    for (const message of messages) {
      // Get post datetime of message
      const postTime = format(message.timestamp, " HH:mm")
      const isoPostDatetime = formatISO(message.timestamp)

      let authorTypeIcon: "🤖" | "🔵" | "🟢" = "🟢"
      if (message.authorType === 1) authorTypeIcon = "🤖"
      if (message.authorType === 2) authorTypeIcon = "🔵"

      const fields: Embed["fields"] = [
        {
          name: "------------------------------------------------",
          value: message.content,
        },
      ]

      //  Deploy message
      const sendMessage = await retry(
        async () =>
          await channelManager.send({
            embeds: [
              {
                type: EmbedType.Rich,
                color: message.authorColor,
                fields: fields,
                timestamp: isoPostDatetime,
                // FIXME: Type guard not working
                author: {
                  name: `${authorTypeIcon} ${message.authorName}    ${postTime}`,
                  icon_url: message.authorImageUrl,
                },
              },
            ],
          })
      )

      // Update message
      const newMessage = message
      newMessage.messageId = sendMessage.id
      await this.updateDiscordMessage(newMessage)
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
   *  Update single dicord message
   * @param message
   */
  async updateDiscordMessage(message: DiscordMessage) {
    return await this.client.discordMessage.upsert({
      where: {
        timestamp: message.timestamp,
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
        authorType: message.authorType,
        authorColor: message.authorColor,
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
        authorType: message.authorType,
        authorColor: message.authorColor,
        authorImageUrl: message.authorImageUrl,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      },
    })
  }

  /**
   * Update many dicord message
   * @param messages
   */
  async updateManyDiscordMessage(messages: DiscordMessage[]) {
    const query = messages.map((message) =>
      this.client.discordMessage.upsert({
        where: {
          timestamp: message.timestamp,
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
          authorType: message.authorType,
          authorColor: message.authorColor,
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
          authorType: message.authorType,
          authorColor: message.authorColor,
          authorImageUrl: message.authorImageUrl,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        },
      })
    )
    await this.client.$transaction([...query])
  }
}
