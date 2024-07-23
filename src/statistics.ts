import {
  DailyStats,
  HourlyStats,
  Message,
  MessageType,
  PersonStats,
} from "./types.js"
import { toWeekday } from "./util.js"

export interface StatisticsOutput {
  dailyStats: DailyStats
  dailyWordStats: DailyStats
  hourlyStats: HourlyStats
  filteredHourlyStats: HourlyStats
  personStats: PersonStats
}

export class StatisticsGenerator {
  dailyStats: DailyStats = {}
  dailyWordStats: DailyStats = {}
  hourlyStats: HourlyStats = []
  personStats: PersonStats = {}
  messages

  constructor(messages: Message[]) {
    this.messages = messages
  }

  generateStatistics(): StatisticsOutput {
    this.messages.forEach((message) => {
      if (message.type == MessageType.Deleted) return console.log("Skip")
      this.updateDailyStats(message)
      this.updateDailyWordStats(message)
      this.updateHourlyStats(message)
      this.updatePersonStats(message)
    })

    const filteredHourlyStats = this.purgePeople(this.hourlyStats)
    return {
      dailyStats: this.dailyStats,
      dailyWordStats: this.dailyWordStats,
      hourlyStats: this.hourlyStats,
      filteredHourlyStats,
      personStats: this.personStats,
    }
  }

  // Daily message-based stats
  updateDailyStats(message: Message) {
    const dateKey = message.dateISO
    const nameKey = message.firstName
    if (!this.dailyStats[dateKey]) this.dailyStats[dateKey] = {}
    const currentCount = this.dailyStats[dateKey][nameKey]
    if (!currentCount) this.dailyStats[dateKey][nameKey] = 0
    this.dailyStats[dateKey][nameKey]++
  }

  // Daily word-based stats
  updateDailyWordStats(message: Message) {
    const { dateISO, content, firstName } = message
    if (!content) return // No words to count!
    // A simple method of counting the number of words
    const words = content.text.split(" ").length
    const stats = this.dailyWordStats

    if (!stats[dateISO]) stats[dateISO] = {}
    const currentCount = stats[dateISO][firstName]
    if (!currentCount) stats[dateISO][firstName] = 0
    stats[dateISO][firstName] += words
  }

  // Hourly stats
  updateHourlyStats(message: Message) {
    const { timestamp, firstName } = message
    const currentWeekday = toWeekday(timestamp.getDay())
    const currentHour = timestamp.getHours().toString()
    const matchedIndex = this.hourlyStats.findIndex(
      (point) =>
        point.hour === currentHour &&
        point.weekday === currentWeekday &&
        point.name === firstName
    )

    if (matchedIndex === -1) {
      this.hourlyStats.push({
        count: 1,
        hour: currentHour,
        weekday: currentWeekday,
        name: firstName,
      })
    } else {
      this.hourlyStats[matchedIndex].count++
    }
  }

  // Per-person stats
  updatePersonStats(message: Message) {
    const { firstName } = message
    if (!(firstName in this.personStats)) this.personStats[firstName] = 0
    this.personStats[firstName]++
  }

  /** Remove individuals from the hourly stats if their total messages is below a threshold */
  purgePeople(hourlyStats: HourlyStats): HourlyStats {
    const minMessages = 100
    const includePeople = Object.entries(this.personStats).map(
      ([person, count]) => (count > minMessages ? person : null)
    )

    return hourlyStats.filter(({ name }) => includePeople.includes(name))
  }
}
