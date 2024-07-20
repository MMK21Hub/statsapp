// Statistic formats (not the same as the CSV output formats)
export type DailyStats = Record<string, Record<string, number>>
export type PersonStats = Record<string, number>
export type HourlyStats = {
  weekday: string
  hour: string
  count: number
  name: string
}[]

export interface Message {
  fullName: string
  firstName: string
  content: string
  timestamp: Date
  dateISO: string
  raw: string
}

export interface StatsAppConfig {
  aliases: Record<string, RegExp>
}
