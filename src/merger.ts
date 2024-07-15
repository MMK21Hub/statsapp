import { Message } from "./types.js"

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

  while (messages[i].timestamp >= targetMessage.timestamp) {
    if (messages[i].timestamp !== targetMessage.timestamp) continue
    if (messages[i].content === targetMessage.content) return i
    i--
  }
  return -1
}

const MAX_OVERLAP_CHECKS = Infinity // 15
export function mergeExports(exports: Message[][]): MergerResult {
  let merged: Message[] = []
  const gaps: MergerGap[] = []

  exports.forEach((currentExport) => {
    if (merged.length === 0) {
      merged.push(...currentExport)
      return
    }

    let attemptedMessages = 1
    while (
      attemptedMessages <= MAX_OVERLAP_CHECKS &&
      attemptedMessages < currentExport.length
    ) {
      const lastMessage = currentExport.at(-attemptedMessages)!
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
