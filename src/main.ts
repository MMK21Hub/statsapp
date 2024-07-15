import { readFile, writeFile, readdir } from "node:fs/promises"
import arg from "arg"
import { DailyStats, HourlyStats, Message, PersonStats } from "./types.js"
import { toWeekday, objectToCSV, arrayWrap, parse12HourTime } from "./util.js"
import * as path from "node:path"
import { mergeExports } from "./merger.js"

const args = arg(
  {
    "--input": String,
    "--input-dir": String,
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

async function readFilesFromDirectory(
  directory: string
): Promise<Map<string, string>> {
  const filenames = await readdir(directory)
  const promises = filenames.map(
    async (filename): Promise<[string, string]> => {
      const fullPath = path.join(directory, filename)
      return [filename, await readFile(fullPath, "utf8")]
    }
  )
  const resultArray = await Promise.all(promises)
  const result = new Map<string, string>()
  resultArray.forEach(([path, content]) => result.set(path, content))
  return result
}

async function getProcessedChatLog(): Promise<Message[]> {
  const inputFile = args["--input"]
  const inputDir = args["--input-dir"]
  if (inputFile) {
    const text = await readFile(inputFile, "utf8")
    return parseChatExport(text)
  }
  if (inputDir) {
    const exports = await readFilesFromDirectory(inputDir)
    const parsedExports = Array.from(exports.values()).map((text) =>
      parseChatExport(text)
    )
    const mergeResult = mergeExports(parsedExports)
    console.warn(mergeResult.gaps)
    return mergeResult.messages
  }

  throw new Error(
    "You must provide the path to a chat export file, or a directory of chat export files"
  )
}

const messages = await getProcessedChatLog()

const dailyStats: DailyStats = {}
const dailyWordStats: DailyStats = {}
const hourlyStats: HourlyStats = []
const personStats: PersonStats = {}

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
  while ((match = chatExportParser.exec(exportData))) {
    const [_, dateString, timeString, name, content] = match!
    const [day, month, year] = dateString.split("/").map((num) => parseInt(num))
    const dateIndexes = [year, month - 1, day] as const
    const dateTime = new Date(...dateIndexes, ...parse12HourTime(timeString))
    const dateISO = dateTime.toISOString().split("T")[0]
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
