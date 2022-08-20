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
      const { id, name, topic, is_archived, pins } = channel

      // チャンネルの必須項目がない場合は例外を投げる
      if (
        id === undefined ||
        name === undefined ||
        topic === undefined ||
        is_archived === undefined
      )
        throw new Error("Channel is missing a required parameter")

      return {
        id: id,
        name: name,
        type: 1,
        topic: topic.value,
        is_archived: is_archived,
        pins: pins?.map((pin) => pin.id).join(",") || null,
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
          id: channel.id,
        },
        update: {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          topic: channel.topic,
          is_archived: channel.is_archived,
          pins: channel.pins,
        },
        create: {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          topic: channel.topic,
          is_archived: channel.is_archived,
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
