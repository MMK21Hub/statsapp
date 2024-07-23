// Statistic formats (not the same as the CSV output formats)
export type DailyStats = Record<string, Record<string, number>>
export type PersonStats = Record<string, number>
export type HourlyStats = {
  weekday: string
  hour: string
  count: number
  name: string
}[]

export enum MessageType {
  Normal = "normal",
  Deleted = "deleted",
  Media = "media",
  Poll = "poll",
}

export interface Message {
  type: MessageType
  fullName: string
  firstName: string
  content?: string
  timestamp: Date
  dateISO: string
  edited?: boolean
  raw: string
}

export interface NormalMessage extends Message {
  type: MessageType.Normal
  content: string
  edited: boolean
}

export interface StatsAppConfig {
  aliases: Record<string, RegExp>
}
