import { readFile, writeFile } from "node:fs/promises"
import arg from "arg"

const args = arg(
  {
    "--input": String,
    "--daily-stats": String,
    "--hourly-stats": String,
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

type DailyStats = Record<string, Record<string, number>>
type PersonStats = Record<string, number>
type HourlyStats = {
  weekday: string
  hour: string
  count: number
  name: string
}[]

const dailyStats: DailyStats = {}
const hourlyStats: HourlyStats = []
const personStats: PersonStats = {}

let match: RegExpMatchArray | null = chatExportParser.exec(data)
while ((match = chatExportParser.exec(data))) {
  const [_, dateString, timeString, name, content] = match!
  const [day, month, year] = dateString.split("/").map((num) => parseInt(num))
  const date = new Date(year, month - 1, day)

  const timeParts = timeString.split(":").map((num) => parseInt(num))
  const isAfternoon = timeString.includes("pm")
  const hour = isAfternoon ? timeParts[0] + 12 : timeParts[0]
  const minute = timeParts[1]
  const dateTime = new Date(year, month - 1, day, hour, minute)
  const firstName = name.split(" ")[0]

  // Daily stats
  {
    const dateKey = date.toLocaleDateString()
    const nameKey = firstName
    if (!dailyStats[dateKey]) dailyStats[dateKey] = {}
    const currentCount = dailyStats[dateKey][nameKey]
    if (!currentCount) dailyStats[dateKey][nameKey] = 0
    dailyStats[dateKey][nameKey]++
  }

  // Hourly stats
  {
    const currentWeekday = toWeekday(date.getDay())
    const currentHour = dateTime.getHours().toString()
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
}

const filteredHourlyStats = purgePeople(personStats, hourlyStats)

const outputs: {
  arg: keyof typeof args
  getOutput: () => string
}[] = [
  { arg: "--daily-stats", getOutput: () => objectToCSV(dailyStats) },
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

function objectToCSV(
  object: Record<string, Record<string, unknown>> | Record<string, unknown>[]
) {
  const useRowHeadings = !Array.isArray(object)
  const dataAs2DArray: string[][] = useRowHeadings ? [[""]] : [[]]
  const indexes = new Map<string, number>()

  Object.entries(object).forEach(([rowHeading, rowData]) => {
    const row = useRowHeadings ? [rowHeading] : []
    Object.entries(rowData).forEach(([colHeading, cell]) => {
      const matchedIndex = indexes.get(colHeading)
      if (matchedIndex !== undefined) return (row[matchedIndex] = `${cell}`)

      // We haven't encountered this key before, so make a new column
      const startingIndex = useRowHeadings ? 1 : 0
      const lastIndex = Array.from(indexes.values()).at(-1)
      const newIndex = lastIndex === undefined ? startingIndex : lastIndex + 1
      indexes.set(colHeading, newIndex)
      row[newIndex] = `${cell}`
    })
    dataAs2DArray.push(row)
  })

  // Add the headings for each column
  indexes.forEach((index, label) => {
    dataAs2DArray[0][index] = label
  })

  // Sort the columns based on sum of their cells
  if (useRowHeadings) {
    const oldColumns = transposeArray(dataAs2DArray)
    const rowHeadings = oldColumns.shift()! // Remove the row headings
    const columnStats: { sum: number; cells: string[] }[] = []
    oldColumns.forEach((cells, index) => {
      const [colHeading, ...rawDataCells] = cells
      const dataCells = rawDataCells.map((num) => parseInt(num))
      const sum = calculateSum(dataCells)
      columnStats.push({ sum, cells })
    })

    const sortedSums = columnStats.sort((a, b) => b.sum - a.sum) // Descending order
    const newColumns = sortedSums.map(({ cells }) => cells)
    newColumns.unshift(rowHeadings) // Add the headings back to the start
    return exportCSV(transposeArray(newColumns))
  }

  return exportCSV(dataAs2DArray)
}

function exportCSV(array2D: string[][]) {
  return array2D.map((row) => row.join(",")).join("\n")
}

function calculateSum(numbers: (number | null | undefined)[]): number {
  const sum = numbers.reduce((a, b) => {
    const numberA = a || 0
    const numberB = b || 0
    return numberA + numberB
  }, 0) as number

  return sum
}

function toWeekday(dayIndex: number) {
  const days: Record<number, string> = {
    1: "Mon",
    2: "Tue",
    3: "Wed",
    4: "Thu",
    5: "Fri",
    6: "Sat",
    0: "Sun",
  }

  if (dayIndex in days) return days[dayIndex]
  throw new Error(`${dayIndex} is not a valid weekday index`)
}

function arrayWrap<T>(arrayMaybe: T[] | T) {
  return Array.isArray(arrayMaybe) ? arrayMaybe : [arrayMaybe]
}

function transposeArray<T>(array: T[][]) {
  return array[0].map((_, colIndex) => array.map((row) => row[colIndex]))
}
