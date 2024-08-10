import { readFile, writeFile, readdir, stat } from "node:fs/promises"
import arg from "arg"
import { Message, StatsAppConfig } from "./types.js"
import { objectToCSV, arrayWrap, debug } from "./util.js"
import * as path from "node:path"
import { MergerGap, MergerPart, mergeExports } from "./merger.js"
import { StatisticsGenerator } from "./statistics.js"
import { messagesToChatLog, parseChatExport } from "./parser.js"

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
