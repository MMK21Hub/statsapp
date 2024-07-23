import { readFile, writeFile, readdir, stat } from "node:fs/promises"
import arg from "arg"
import {
  DailyStats,
  HourlyStats,
  Message,
  MessageType,
  PersonStats,
  StatsAppConfig,
} from "./types.js"
import {
  toWeekday,
  objectToCSV,
  arrayWrap,
  parseFormattedTime,
  debug,
} from "./util.js"
import * as path from "node:path"
import { MergerGap, MergerPart, mergeExports } from "./merger.js"

export const args = arg(
  {
    "--input": String,
    "--input-dir": String,
    "--config": String,
    "--verbose": Boolean,
    "--daily-stats": String,
    "--hourly-stats": String,
    "--daily-word-stats": String,
    "--chat-log": String,
  },
  {
    permissive: true,
  }
)

async function getConfig(): Promise<StatsAppConfig> {
  if (!args["--config"])
    return {
      aliases: {},
    }

  const configPath = path.resolve(args["--config"])
  const configImport = await import(configPath)
  debug(`Imported config file from ${configPath}`)
  return configImport.default as StatsAppConfig
}

const config = await getConfig()

const chatExportParser =
  /^(\d{2}\/\d{2}\/\d{4}), (\d{1,2}:\d{2} ?[ap]?m?) - (.*): (.*)/gm
const contactNameExtractor =
  /(?<=^\d{2}\/\d{2}\/\d{4}, \d{1,2}:\d{2} ?[ap]?m? - ).*(?=: .*)/gm

async function readFilesFromDirectory(
  directory: string
): Promise<Map<string, string>> {
  const filenames = await readdir(directory)
  const resultMap = new Map<string, string>()
  const promises = filenames.map(
    async (filename): Promise<[string, string] | undefined> => {
      const fullPath = path.join(directory, filename)
      const fileInfo = await stat(fullPath)
      if (!fileInfo.isFile()) return
      const contents = await readFile(fullPath, "utf8")
      resultMap.set(filename, contents)
    }
  )
  await Promise.all(promises)
  return resultMap
}

function printMergeResultSummary(parts: MergerPart[], gaps: MergerGap[]) {
  console.log(`Merged messages from ${parts.length} chat export(s):`)
  parts.forEach(({ file, from, to }) => {
    console.log(
      `  ${file}: ${from.toLocaleDateString()} --> ${to.toLocaleDateString()}`
    )
  })
  if (gaps.length === 0) {
    console.log(`No gaps in the data!`)
    return
  }
  console.log(`Gaps in the data:`)
  gaps.forEach(({ from, to }) => {
    console.log(
      `  Missing ${from.toLocaleDateString()} --> ${to.toLocaleDateString()}`
    )
  })
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
    const parsedExports: [string, Message[]][] = Array.from(exports.entries())
      .map(([filename, text]): [string, Message[]] => [
        filename,
        parseChatExport(text),
      ])
      .sort(([_a, messages_a], [_b, messages_b]) => {
        // Sort by the time of the first message in each export
        const timestamp_a = messages_a[0].timestamp
        const timestamp_b = messages_b[0].timestamp
        return timestamp_a.valueOf() - timestamp_b.valueOf()
      })
    const mergeResult = mergeExports(new Map(parsedExports))
    printMergeResultSummary(mergeResult.parts, mergeResult.gaps)
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
  if (!content) return

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
  { arg: "--chat-log", getOutput: () => messagesToChatLog(messages) },
]

for (const config of outputs) {
  const output = config.getOutput()
  const outputPath = args[config.arg] as string | string[]
  if (!outputPath) continue

  for (const path of arrayWrap(outputPath)) {
    await writeFile(path, output, "utf8")
  }
}

/**
 * Parses a chat export file from WhatsApp. Doesn't work with messages that contain newlines.
 * Ignores system messages.
 * @returns an array of messages
 */
function parseChatExport(exportData: string) {
  const startTime = process.hrtime()
  const messages: Message[] = []

  let match: RegExpMatchArray | null = chatExportParser.exec(exportData)
  while ((match = chatExportParser.exec(exportData))) {
    const [fullMatch, dateString, timeString, name, rawContent] = match!
    const [day, month, year] = dateString.split("/").map((num) => parseInt(num))
    const dateIndexes = [year, month - 1, day] as const
    const dateTime = new Date(...dateIndexes, ...parseFormattedTime(timeString))
    const dateISO = dateTime.toISOString().split("T")[0]
    const normalName = normalizeName(name)
    const firstName = normalName.split(" ")[0]

    const { type, content, edited } = parseMessageContent(rawContent)

    messages.push({
      type,
      content,
      edited,
      fullName: normalName,
      firstName,
      timestamp: dateTime,
      dateISO,
      raw: fullMatch,
    })
  }

  const [timeSecs, timeNanosecs] = process.hrtime(startTime)
  const milliseconds = (timeNanosecs + timeSecs * 10 ** 9) / 10 ** 6

  debug(`Parsed ${messages.length} messages in ${milliseconds.toFixed(1)} ms`)
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

function normalizeName(inputName: string) {
  const aliasMatch = Object.entries(config.aliases).find(([_, regex]) => {
    return regex.test(inputName)
  })

  if (aliasMatch) {
    const normalName = aliasMatch[0]
    return normalName
  }

  return inputName.trim()
}

function parseMessageContent(rawContent: string): {
  type: MessageType
  edited?: boolean
  content?: string
} {
  if (rawContent === "POLL:")
    return {
      type: MessageType.Poll,
    }
  if (rawContent === "<Media omitted>")
    return {
      type: MessageType.Media,
    }
  if (rawContent === "This message was deleted")
    return {
      type: MessageType.Deleted,
    }

  const isEdited = rawContent.endsWith("<This message was edited>")
  const messageContent = isEdited
    ? rawContent.replace(/<This message was edited>$/, "")
    : rawContent

  return {
    type: MessageType.Normal,
    content: messageContent,
    edited: isEdited,
  }
}

function messagesToChatLog(messages: Message[]) {
  const allowedMessageTypes = [MessageType.Normal, MessageType.Media]

  return messages
    .filter((msg) => allowedMessageTypes.includes(msg.type))
    .map((msg) => {
      return msg.raw.replace(contactNameExtractor, normalizeName)
    })
    .join("\n")
}
