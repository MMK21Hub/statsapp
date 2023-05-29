import {} from "node:fs"

const chatExportParser =
  /^(\d{2}\/\d{2}\/\d{4}), (\d{1,2}:\d{2} [ap]m) - (.*): (.*)/
