import { readFile } from "node:fs/promises"

const chatExportParser =
  /^(\d{2}\/\d{2}\/\d{4}), (\d{1,2}:\d{2} [ap]m) - (.*): (.*)/gm

const data = await readFile(process.argv[2], "utf8")

const messagesPerDay = new Map<string, number>()

let match: RegExpMatchArray | null = chatExportParser.exec(data)
while ((match = chatExportParser.exec(data))) {
  const [_, dateString, timeString, name, content] = match!
  const [day, month, year] = dateString.split("/").map((num) => parseInt(num))
  const date = new Date(year, month, day)

  const key = date.toString()
  const oldCount = messagesPerDay.get(key) || 0
  messagesPerDay.set(key, oldCount + 1)
}

// console.log(messagesPerDay)
messagesPerDay.forEach((count, dateString) => {
  const date = new Date(dateString)
  console.log(`${date.getDay}, ${count}`)
})
debugger
