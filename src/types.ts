// Statistic formats (not the same as the CSV output formats)
export type DailyStats = Record<string, Record<string, number>>
export type PersonStats = Record<string, number>
export type HourlyStat = {
  weekday: string
  hour: string
  count: number
  name: string
}

export type HourlyStats = HourlyStat[]

export enum MessageType {
  Normal = "normal",
  Deleted = "deleted",
  Media = "media",
  ViewOnceMedia = "view-once-media",
  Poll = "poll",
}

export interface MessageContent {
  text: string
  edited: boolean
}

export interface Message {
  type: MessageType
  fullName: string
  firstName: string
  content?: MessageContent
  timestamp: Date
  dateISO: string
  raw: string
}

/** Configuration options for StatsApp */
export interface StatsAppConfig {
  people: Record<string, PersonOptions>
}

/** Customization options for a person */
export type PersonOptions = {
  /** An exact string, or a regular expression to match contact names that correspond to this contact */
  match: RegExp | string
  /** Set to `false` to exclude this contact from any reports */
  include?: boolean
}
