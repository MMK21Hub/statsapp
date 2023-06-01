import { readFile, writeFile } from "node:fs/promises"
import arg from "arg"
import { DailyStats, HourlyStats, Message, PersonStats } from "./types.js"
import { toWeekday, objectToCSV, arrayWrap } from "./util.js"

const args = arg(
  {
    "--input": String,
    "--daily-stats": String,
    "--hourly-stats": String,
    "--daily-word-stats": String,
  },
  {
    permissive: true,
  }
)

const chatExportParser =
  /^(\d{2}\/\d{2}\/\d{4}), (\d{1,2}:\d{2} [ap]m) - (.*): (.*)/gm

const inputFile = args["--input"]
if (!inputFile)
  throw new Error("You must provide the path to the chat export file")
const data = await readFile(inputFile, "utf8")

const dailyStats: DailyStats = {}
const dailyWordStats: DailyStats = {}
const hourlyStats: HourlyStats = []
const personStats: PersonStats = {}

const messages = parseChatExport(data)

messages.forEach(({ dateISO, firstName, timestamp, content }) => {
  // Daily message-based stats
  {
    const dateKey = dateISO
    const nameKey = firstName
    if (!dailyStats[dateKey]) dailyStats[dateKey] = {}
    const currentCount = dailyStats[dateKey][nameKey]
    if (!currentCount) dailyStats[dateKey][nameKey] = 0
    dailyStats[dateKey][nameKey]++
  }

  // Daily word-based stats
  {
    // A simple method of counting the number of words
    const words = content.split(" ").length
    const stats = dailyWordStats

    if (!stats[dateISO]) stats[dateISO] = {}
    const currentCount = stats[dateISO][firstName]
    if (!currentCount) stats[dateISO][firstName] = 0
    stats[dateISO][firstName] += words
  }

  // Hourly stats
  {
    const currentWeekday = toWeekday(timestamp.getDay())
    const currentHour = timestamp.getHours().toString()
    const matchedIndex = hourlyStats.findIndex(
      (point) =>
        point.hour === currentHour &&
        point.weekday === currentWeekday &&
        point.name === firstName
    )

    if (matchedIndex === -1) {
      hourlyStats.push({
        count: 1,
        hour: currentHour,
        weekday: currentWeekday,
        name: firstName,
      })
    } else {
      hourlyStats[matchedIndex].count++
    }
  }

  // Per-person stats
  {
    if (!(firstName in personStats)) personStats[firstName] = 0
    personStats[firstName]++
  }
})

const filteredHourlyStats = purgePeople(personStats, hourlyStats)

const outputs: {
  arg: keyof typeof args
  getOutput: () => string
}[] = [
  { arg: "--daily-stats", getOutput: () => objectToCSV(dailyStats) },
  { arg: "--daily-word-stats", getOutput: () => objectToCSV(dailyWordStats) },
  { arg: "--hourly-stats", getOutput: () => objectToCSV(filteredHourlyStats) },
]

for (const config of outputs) {
  const output = config.getOutput()
  const outputPath = args[config.arg]
  if (!outputPath) continue

  for (const path of arrayWrap(outputPath)) {
    await writeFile(path, output, "utf8")
  }
}

debugger

/**
 * Parses a chat export file from WhatsApp. Doesn't work with messages that contain newlines.
 * Ignores system messages.
 * @returns an array of messages
 */
function parseChatExport(exportData: string) {
  const messages: Message[] = []

  let match: RegExpMatchArray | null = chatExportParser.exec(exportData)
  while ((match = chatExportParser.exec(data))) {
    const [_, dateString, timeString, name, content] = match!
    const [day, month, year] = dateString.split("/").map((num) => parseInt(num))
    const date = new Date(year, month - 1, day)
    const dateISO = date.toISOString().split("T")[0]

    const timeParts = timeString.split(":").map((num) => parseInt(num))
    const isAfternoon = timeString.includes("pm")
    const hour = isAfternoon ? timeParts[0] + 12 : timeParts[0]
    const minute = timeParts[1]
    const dateTime = new Date(year, month - 1, day, hour, minute)
    const firstName = name.split(" ")[0]

    messages.push({
      content,
      fullName: name,
      firstName,
      timestamp: dateTime,
      dateISO,
    })
  }

  return messages
}

/** Remove individuals from the hourly stats if their total messages is below a threshold */
function purgePeople(
  personStats: PersonStats,
  hourlyStats: HourlyStats
): HourlyStats {
  const minMessages = 100
  const includePeople = Object.entries(personStats).map(([person, count]) =>
    count > minMessages ? person : null
  )

  return hourlyStats.filter(({ name }) => includePeople.includes(name))
}
