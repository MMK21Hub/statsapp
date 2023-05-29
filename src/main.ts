import { readFile } from "node:fs/promises"

const chatExportParser =
  /^(\d{2}\/\d{2}\/\d{4}), (\d{1,2}:\d{2} [ap]m) - (.*): (.*)/gm

const data = await readFile(process.argv[2], "utf8")

const results: Record<string, Record<string, number>> = {}

let match: RegExpMatchArray | null = chatExportParser.exec(data)
while ((match = chatExportParser.exec(data))) {
  const [_, dateString, timeString, name, content] = match!
  const [day, month, year] = dateString.split("/").map((num) => parseInt(num))
  const fullDate = new Date(year, month - 1, day)

  const dateKey = fullDate.toLocaleDateString()
  const nameKey = name.split(" ")[0]
  if (!results[dateKey]) results[dateKey] = {}
  const targetCount = results[dateKey][nameKey]
  if (!targetCount) results[dateKey][nameKey] = 0
  results[dateKey][nameKey]++
}

console.log(objectToCSV(results))
debugger

function objectToCSV(object: Record<string, Record<string, unknown>>) {
  const dataAs2DArray: string[][] = [[""]]
  const indexes = new Map<string, number>()

  Object.entries(object).forEach(([rowHeading, rowData]) => {
    const row = [rowHeading]
    Object.entries(rowData).forEach(([colHeading, cell]) => {
      const matchedIndex = indexes.get(colHeading)
      if (matchedIndex) return (row[matchedIndex] = `${cell}`)

      // We haven't encountered this key before, so make a new column
      const lastIndex = Array.from(indexes.values()).at(-1) || 0
      const newIndex = lastIndex + 1
      indexes.set(colHeading, newIndex)
      row[newIndex] = `${cell}`
    })
    dataAs2DArray.push(row)
  })

  // Add the headings for each column
  indexes.forEach((index, label) => {
    dataAs2DArray[0][index] = label
  })

  const dataAsCSV = dataAs2DArray.map((row) => row.join(",")).join("\n")
  return dataAsCSV
}
