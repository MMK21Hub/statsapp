import { readFile } from "node:fs/promises"

const chatExportParser =
  /^(\d{2}\/\d{2}\/\d{4}), (\d{1,2}:\d{2} [ap]m) - (.*): (.*)/gm

const data = await readFile(process.argv[2], "utf8")

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

console.log(objectToCSV(filteredHourlyStats))
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

  const dataAsCSV = dataAs2DArray.map((row) => row.join(",")).join("\n")
  return dataAsCSV
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
