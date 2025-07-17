import { readFile, writeFile } from "node:fs/promises"
import arg from "arg"
import { Message, StatsAppConfig } from "./types.js"
import { objectToCSV, arrayWrap, debug } from "./util.js"
import * as path from "node:path"
import { StatisticsGenerator } from "./statistics.js"
import { messagesToChatLog, parseChatExport } from "./parser.js"

export const args = arg(
  {
    "--input": String,
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
