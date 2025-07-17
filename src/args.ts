import path from "node:path"
import { debug } from "./util.js"
import { StatsAppConfig } from "./types.js"
import arg from "arg"

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

export const config = await getConfig()
