import { readFile, writeFile } from "node:fs/promises"
import { Message } from "./types.js"
import { objectToCSV, arrayWrap } from "./util.js"
import { StatisticsGenerator } from "./statistics.js"
import { messagesToChatLog, parseChatExport } from "./parser.js"
import { args } from "./args.js"

async function getProcessedChatLog(): Promise<Message[]> {
  const inputFile = args["--input"]
  if (!inputFile)
    throw new Error(
      "You must provide the path to a chat export file, or a directory of chat export files"
    )

  const text = await readFile(inputFile, "utf8")
  return parseChatExport(text)
}

const messages = await getProcessedChatLog()

const statisticsGenerator = new StatisticsGenerator(messages)
const { dailyStats, dailyWordStats, filteredHourlyStats } =
  statisticsGenerator.generateStatistics()

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
