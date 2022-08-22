import { PrismaClient, Message, User } from "@prisma/client"
import { access, readFile, constants, readdir } from "node:fs/promises"
import { statSync } from "node:fs"
import { join } from "node:path"
import { format, formatISO, fromUnixTime, addSeconds } from "date-fns"
import { WebClient as SlackClient } from "@slack/web-api"
import { FileElement } from "@slack/web-api/dist/response/ChatPostMessageResponse"
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
  files?: FileElement[]
}

interface File {
  url: string
  size: number
}

export class MessageClient {
  client: PrismaClient
  channelClient: ChannelClient
  userClient: UserClient
  constructor(client = new PrismaClient()) {
    this.client = client
    this.channelClient = new ChannelClient(this.client)
    this.userClient = new UserClient(this.client)
  }

  /**
   * Migrate all message data
   * @param slackClient
   * @param srcDirpath
   */
  async migrateAllMessage(slackClient: SlackClient, srcDirpath: string) {
    // Get all channel data
    const channels = await this.channelClient.getAllChannel()

    for (const channel of channels) {
      if (!channel.deployId)
        throw new Error(`Failed to deployed channel id of ${channel.id}`)

      // Get message file paths
      const messageDirPath = join(srcDirpath, channel.name)
      const messageFilePaths = await this.getAllSlackMessageFilePath(
        messageDirPath
      )

      for (const messageFilePath of messageFilePaths) {
        // Get message file
        const messages = await this.getSlackMessageFile(messageFilePath)

        const newMessages: Message[] = []
        for (const message of messages) {
          if (
            message.type === undefined ||
            message.text === undefined ||
            message.ts === undefined
          ) {
            throw new Error("Message is missing required parameter")
          }

          // Convert message content
          const content = await this.convertMessageContent(
            this.userClient,
            message.text
          )

          // Get pinned item
          const pinIds = channel.pins ? channel.pins.split(",") : []
          const isPinned = pinIds.includes(message.ts)

          // Get attached file
          const files = message.files
            ? JSON.stringify(
                message.files.map((file) => {
                  if (!file.url_private || !file.size)
                    throw new Error("File is missing required parameter")
                  return {
                    url: file.url_private,
                    size: file.size,
                  } as File
                })
              )
            : null

          // TODO: Message type
          let messageType = 1

          // Get message author
          let author: User | null = null
          if (message.bot_id) {
            author = await this.userClient.getBot(slackClient, message.bot_id)
          } else if (message.user) {
            author = await this.userClient.getUser(slackClient, message.user)
          }
          if (!author) throw new Error("Failed to get message author")

          newMessages.push({
            timestamp: fromUnixTime(Number(message.ts)),
            deployId: null,
            channelDeployId: channel.deployId,
            content: content,
            files: files,
            type: messageType,
            isPinned: isPinned,
            authorId: author.id,
            authorName: author.name,
            authorType: author.type,
            authorColor: author.color,
            authorImageUrl: author.imageUrl,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        }

        // Update many message
        await this.updateManyMessage(newMessages)
      }
    }
  }

  /**
   * Deploy all message
   * @param discordClient
   */
  async deployAllMessage(discordClient: DiscordClient) {
    //  Get all channel data
    const channels = await this.channelClient.getAllChannel()
    for (const channel of channels) {
      if (!channel.deployId)
        throw new Error(`Failed to deployed channel id of ${channel.name}`)

      const channelManager = discordClient.channels.cache.get(channel.deployId)
      if (
        channelManager === undefined ||
        channelManager.type !== ChannelType.GuildText
      )
        throw new Error(`Failed to get channel manager of ${channel.id}`)

      // Get max file size for server boost level
      const boostCount = channelManager.guild.premiumSubscriptionCount || 0
      let maxFileSize: 8000000 | 50000000 | 100000000 = 8000000
      if (boostCount >= 7 && boostCount < 14) {
        maxFileSize = 50000000
      } else if (boostCount >= 14) {
        maxFileSize = 100000000
      }

      // Pagination message
      const take = 100
      let skip = 0
      const total = await this.client.message.count({
        where: {
          channelDeployId: channel.deployId,
        },
      })
      while (skip < total) {
        const messages = await this.client.message.findMany({
          take: take,
          skip: skip,
          where: {
            channelDeployId: channel.deployId,
          },
          orderBy: {
            timestamp: "asc",
          },
        })

        // Deploy many message
        await this.deployManyMessage(channelManager, messages, maxFileSize)

        skip += take
      }
    }
  }

  /**
   * Deploy many message
   * @param channelManager
   * @param messages
   * @param maxFileSize
   */
  async deployManyMessage(
    channelManager: TextChannel,
    messages: Message[],
    maxFileSize: 8000000 | 50000000 | 100000000
  ) {
    for (const message of messages) {
      await this.deployMessage(channelManager, message)

      // Deploy attached file as separate message so that attached file show below embed
      if (message.files) {
        const files = JSON.parse(message.files) as File[]
        await this.deployManyFile(channelManager, message, files, maxFileSize)
      }
    }
  }

  /**
   * Deploy single message
   * @param channelManager
   * @param message
   */
  async deployMessage(channelManager: TextChannel, message: Message) {
    // Get post datetime of message
    const postTime = format(message.timestamp, " HH:mm")
    const isoPostDatetime = formatISO(message.timestamp)

    let authorTypeIcon: "🤖" | "🔵" | "🟢" = "🟢"
    if (message.authorType === 1) authorTypeIcon = "🤖"
    if (message.authorType === 2) authorTypeIcon = "🔵"

    const fields: Embed["fields"] = [
      {
        name: "------------------------------------------------",
        value: message.content || "",
      },
    ]

    //  Deploy message
    const sendMessage = await channelManager.send({
      embeds: [
        {
          type: EmbedType.Rich,
          color: message.authorColor,
          fields: fields,
          timestamp: isoPostDatetime,
          author: {
            name: `${authorTypeIcon} ${message.authorName}    ${postTime}`,
            icon_url: message.authorImageUrl,
          },
        },
      ],
    })

    // Update message
    const newMessage = (() => message)()
    newMessage.deployId = sendMessage.id
    await this.updateMessage(newMessage)
  }

  /**
   * Deploy many file
   * @param channelManager
   * @param message
   * @param files
   * @param maxFileSize
   */
  async deployManyFile(
    channelManager: TextChannel,
    message: Message,
    files: File[],
    maxFileSize: 8000000 | 50000000 | 100000000
  ) {
    // If file exceeds max upload file size, file url is attached without uploading file
    const sizeOverFileUrls = files
      ?.filter((file) => file.size && file.size >= maxFileSize)
      .map((file) => file.url)
    const uploadFileUrls = files
      ?.filter((file) => file.size && file.size < maxFileSize)
      .map((file) => file.url)

    //  Deploy message with file
    const sendMessage = await channelManager.send({
      content: sizeOverFileUrls.join("\n"),
      files: uploadFileUrls,
    })

    // Update message with file
    const newMessage = (() => message)()
    // Add 1 second to prevent duplicate timestamp
    newMessage.timestamp = addSeconds(new Date(), 1)
    newMessage.deployId = sendMessage.id
    await this.updateMessage(newMessage)
  }

  /**
   * Destroy all message
   */
  async destroyAllMessage(discordClient: DiscordClient) {
    //  Get all channel data
    const channels = await this.channelClient.getAllChannel()

    // Delete all messages
    await Promise.all(
      channels.map(async (channel) => {
        if (!channel.deployId)
          throw new Error(`Failed to deployed channel id of ${channel.name}`)

        const channelManager = discordClient.channels.cache.get(
          channel.deployId
        )
        if (
          channelManager === undefined ||
          channelManager.type !== ChannelType.GuildText
        )
          throw new Error(`Failed to get channel manager of ${channel.id}`)

        // Pagination message
        const take = 100
        let skip = 0
        const total = await this.client.message.count({
          where: {
            channelDeployId: channel.deployId,
          },
        })
        while (skip < total) {
          const messages = await this.client.message.findMany({
            take: take,
            skip: skip,
            where: {
              channelDeployId: channel.deployId,
            },
            orderBy: {
              timestamp: "asc",
            },
          })

          // Destroy many message
          await this.destroyManyMessage(channelManager, messages)

          skip += take
        }
      })
    )
  }

  /**
   * Destroy many message
   * @param channelManager
   * @param messages
   */
  async destroyManyMessage(channelManager: TextChannel, messages: Message[]) {
    const newMessages = await Promise.all(
      messages
        // Skip destroy undeployed message
        .filter((message) => message.deployId)
        .map(async (message) => {
          // Destroy message
          // FIXME: Want to avoid forced type casting
          await channelManager.messages.delete(message.deployId as string)

          const newMessage = (() => message)()
          newMessage.deployId = null

          return newMessage
        })
    )

    // Update deployed message
    await this.updateManyMessage(newMessages)
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
   * Convert message content
   * @param userClient
   * @param content
   */
  async convertMessageContent(userClient: UserClient, content: string) {
    let newContent = content

    // Replace mention
    const matchMention = newContent.match(/<@U[A-Z0-9]{10}>/g)
    if (matchMention?.length) {
      const userIds = matchMention.map((mention) =>
        mention.replace(/<@|>/g, "")
      )
      for (const userId of userIds) {
        const username = await userClient.getUsername(userId)
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
  async updateMessage(message: Message) {
    return await this.client.message.upsert({
      where: {
        timestamp: message.timestamp,
      },
      update: {
        timestamp: message.timestamp,
        deployId: message.deployId,
        channelDeployId: message.channelDeployId,
        content: message.content,
        files: message.files,
        type: message.type,
        isPinned: message.isPinned,
        authorId: message.authorId,
        authorName: message.authorName,
        authorType: message.authorType,
        authorColor: message.authorColor,
        authorImageUrl: message.authorImageUrl,
      },
      create: {
        timestamp: message.timestamp,
        deployId: message.deployId,
        channelDeployId: message.channelDeployId,
        content: message.content,
        files: message.files,
        type: message.type,
        isPinned: message.isPinned,
        authorId: message.authorId,
        authorName: message.authorName,
        authorType: message.authorType,
        authorColor: message.authorColor,
        authorImageUrl: message.authorImageUrl,
      },
    })
  }

  /**
   * Update many message
   * @param messages
   */
  async updateManyMessage(messages: Message[]) {
    const query = messages.map((message) =>
      this.client.message.upsert({
        where: {
          timestamp: message.timestamp,
        },
        update: {
          deployId: message.deployId,
          channelDeployId: message.channelDeployId,
          content: message.content,
          files: message.files,
          type: message.type,
          isPinned: message.isPinned,
          authorId: message.authorId,
          authorName: message.authorName,
          authorType: message.authorType,
          authorColor: message.authorColor,
          authorImageUrl: message.authorImageUrl,
        },
        create: {
          timestamp: message.timestamp,
          deployId: message.deployId,
          channelDeployId: message.channelDeployId,
          content: message.content,
          files: message.files,
          type: message.type,
          isPinned: message.isPinned,
          authorId: message.authorId,
          authorName: message.authorName,
          authorType: message.authorType,
          authorColor: message.authorColor,
          authorImageUrl: message.authorImageUrl,
        },
      })
    )
    await this.client.$transaction([...query])
  }
}
