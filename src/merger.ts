import { Message } from "./types.js"
import { debug } from "./util.js"

export interface MergerGap {
  from: Date
  to: Date
}

export interface MergerPart {
  from: Date
  to: Date
  file: string
}

export interface MergerResult {
  /** A flattened array of messages */
  messages: Message[]
  /** Describes any gaps in the data, i.e. where time has passed between non-overlapping exports */
  gaps: MergerGap[]
  /** Describes which chat exports were used for which time period */
  parts: MergerPart[]
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
    if (messages[i].timestamp.getTime() !== targetMessage.timestamp.getTime()) {
      i--
      continue
    }
    if (messages[i].content === targetMessage.content) {
      return i
    }
    i--
  }
  return -1
}

const MAX_OVERLAP_CHECKS = Infinity // 15
export function mergeExports(exports: Map<string, Message[]>): MergerResult {
  debug(`Merging ${exports.size} chat exports`)
  let merged: Message[] = []
  const gaps: MergerGap[] = []
  const parts: MergerPart[] = []

  exports.forEach((currentExport, filename) => {
    debug(`Merging export from file ${filename}`)
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
      const lastMessage = currentExport.at(attemptedMessages)!
      const matchResult = findMatchingMessage(merged, lastMessage)
      if (matchResult === null) {
        gaps.push({
          from: merged.at(-1)!.timestamp,
          to: currentExport.at(0)!.timestamp,
        })
        merged.push(...currentExport)
        parts.push({
          file: filename,
          from: currentExport.at(0)!.timestamp,
          to: currentExport.at(-1)!.timestamp,
        })
        return
      }
      if (matchResult > -1) {
        merged = merged.slice(0, matchResult)
        merged.push(...currentExport)
        return
      }
    }
  })

  return {
    messages: merged,
    gaps,
    parts,
  }
}
