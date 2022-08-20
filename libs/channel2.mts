import { PrismaClient, SlackChannel } from "@prisma/client"
import { access, readFile, constants } from "node:fs/promises"

interface SlackChannelFile {
  id?: string
  name?: string
  purpose?: string
  topic?: {
    value: string
  }
  is_archived?: boolean
  pins?: {
    id: string
    user: string
  }[]
}

export class ChannelClient {
  client: PrismaClient
  constructor(client = new PrismaClient()) {
    this.client = client
  }

  /**
   * Migrate channel
   * @param channelFilePath
   */
  async migrateChannel(channelFilePath: string): Promise<void> {
    // チャンネルを取得
    const channels = await this.getSlackChannelFile(channelFilePath)

    // チャンネルを変換
    const newChannels: SlackChannel[] = channels.map((channel) => {
      // チャンネルの必須項目がない場合は例外を投げる
      if (
        channel.id === undefined ||
        channel.name === undefined ||
        channel.topic === undefined ||
        channel.is_archived === undefined
      )
        throw new Error("Channel is missing a required parameter")

      return {
        id: 0,
        channelId: channel.id,
        name: channel.name,
        type: 1,
        topic: channel.topic.value,
        isArchived: channel.is_archived,
        pins: channel.pins?.map((pin) => pin.id).join(",") || null,
      }
    })

    await this.upsertSlackChannelMany(newChannels)
  }

  /**
   * Get slack channel file
   * @param channelFilePath
   */
  async getSlackChannelFile(
    channelFilePath: string
  ): Promise<SlackChannelFile[]> {
    await access(channelFilePath, constants.R_OK)
    const channels = JSON.parse(
      await readFile(channelFilePath, "utf8")
    ) as SlackChannelFile[]
    return channels
  }

  /**
   * Upsert many slack channel
   * @param channels
   */
  async upsertSlackChannelMany(channels: SlackChannel[]): Promise<void> {
    const query = channels.map((channel) =>
      this.client.slackChannel.upsert({
        where: {
          channelId: channel.channelId,
        },
        update: {
          name: channel.name,
          type: channel.type,
          topic: channel.topic,
          isArchived: channel.isArchived,
          pins: channel.pins,
        },
        create: {
          channelId: channel.channelId,
          name: channel.name,
          type: channel.type,
          topic: channel.topic,
          isArchived: channel.isArchived,
          pins: channel.pins,
        },
      })
    )
    await this.client.$transaction([...query])
  }

  // async connect(): Promise<void> {
  //   await this.client.$connect()
  // }

  // async disconnect(): Promise<void> {
  //   await this.client.$disconnect()
  // }
}
