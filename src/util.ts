import { args } from "./args.js"

export function debug(string: string) {
  if (!args["--verbose"]) return
  console.debug(string)
}

export function objectToCSV(
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

/** Turns a 2D array of strings into a CSV string. Doesn't support CSV quotes or escaping. */
export function exportCSV(array2D: string[][]) {
  return array2D.map((row) => row.join(",")).join("\n")
}

/** Sums an array of numbers, treating nullish values as `0` */
export function calculateSum(numbers: (number | null | undefined)[]): number {
  const sum = numbers.reduce((a, b) => {
    const numberA = a || 0
    const numberB = b || 0
    return numberA + numberB
  }, 0) as number

  return sum
}

/**
 * Maps weekday indexes to weekday names
 * @param dayIndex The weekday index, as returned by `Date#getDay()`
 * @returns The short English version of the day, e.g. "Mon"
 */
export function toWeekday(dayIndex: number) {
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

/**
 * Parses a 12-hour timestamp, e.g. "6:19 pm", or a 24-hour one, into a 24-hour time
 * @param time The time string in human-readable form
 * @returns An array of numbers. First item is the hour and second item is the minute.
 */
export function parseFormattedTime(time: string): [number, number] {
  const parts = time.split(" ")
  if (parts.length === 1) {
    const [hour, minute] = parts[0].split(":").map((num) => parseInt(num))
    return [hour, minute]
  }

  const numberPart = parts[0]
  const [rawHour, rawMinute] = numberPart.split(":").map((num) => parseInt(num))
  const isAfternoon = time.includes("pm")

  if (isAfternoon) {
    // e.g. 12:15 pm
    if (rawHour === 12) return [12, rawMinute]
    // e.g. 3:30 pm
    const actualHour = rawHour + 12
    return [actualHour, rawMinute]
  }

  // e.g. 12:05 am
  if (rawHour === 12) return [0, rawMinute]
  // e.g. 7:00 am
  return [rawHour, rawMinute]
}

/** If the parameter isn't an array, returns a single-item array with it in. Otherwise, returns the provided array. */
export function arrayWrap<T>(arrayMaybe: T[] | T) {
  return Array.isArray(arrayMaybe) ? arrayMaybe : [arrayMaybe]
}

/** "Rotates" a 2D array, turning its rows into columns and columns into rows */
export function transposeArray<T>(array: T[][]) {
  return array[0].map((_, colIndex) => array.map((row) => row[colIndex]))
}
