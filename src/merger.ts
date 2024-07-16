import { Message } from "./types.js"
import { debug } from "./util.js"

export interface MergerGap {
  from: Date
  to: Date
}

export interface MergerResult {
  /** A flattened array of messages */
  messages: Message[]
  /** Describes any gaps in the data, i.e. where time has passed between non-overlapping exports */
  gaps: MergerGap[]
}

function findReverse<T>(array: T[], target: T) {
  for (let i = array.length - 1; i >= 0; i--) {
    if (array[i] === target) return i
  }
  return null
}

function findMatchingMessage(messages: Message[], targetMessage: Message) {
  let i = messages.length - 1

  if (messages[i].timestamp < targetMessage.timestamp) {
    // The messages array ends before the target message was sent
    return null
  }

  while (messages[i].timestamp >= targetMessage.timestamp && i >= 0) {
    if (messages[i].timestamp !== targetMessage.timestamp) {
      i--
      continue
    }
    if (messages[i].content === targetMessage.content) {
      debugger
      return i
    }
    console.log("AAA")
  }
  return -1
}

const MAX_OVERLAP_CHECKS = Infinity // 15
export function mergeExports(exports: Message[][]): MergerResult {
  debug(`Merging ${exports.length} chat exports`)
  let merged: Message[] = []
  const gaps: MergerGap[] = []

  exports.forEach((currentExport, i) => {
    debug(`Merging export at index ${i}`)
    if (merged.length === 0) {
      merged.push(...currentExport)
      debug(`Added first export to chat log`)
      return
    }

    let attemptedMessages = 0
    while (
      attemptedMessages <= MAX_OVERLAP_CHECKS &&
      attemptedMessages < currentExport.length
    ) {
      attemptedMessages++
      debug(
        `Looking for a match for current export message @ index ${attemptedMessages}`
      )
      debugger
      const lastMessage = currentExport.at(attemptedMessages)!
      const matchResult = findMatchingMessage(merged, lastMessage)
      if (matchResult === null) {
        gaps.push({
          from: currentExport.at(-1)!.timestamp,
          to: lastMessage.timestamp,
        })
        merged.push(...currentExport)
        return
      }
      if (matchResult > -1) {
        merged = merged.slice(0, matchResult)
        return
      }
    }
  })

  return {
    messages: merged,
    gaps,
  }
}
