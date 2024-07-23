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

  if (!targetMessage.content) {
    // We can't match a message that doesn't have any identifying text content
    return -1
  }

  while (messages[i].timestamp >= targetMessage.timestamp && i >= 0) {
    const currentMessage = messages[i]
    if (
      currentMessage.timestamp.getTime() !== targetMessage.timestamp.getTime()
    ) {
      i--
      continue
    }
    if (!currentMessage.content) {
      i--
      continue
    }
    if (currentMessage.content.text === targetMessage.content.text) {
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
      parts.push({
        file: filename,
        from: currentExport.at(0)!.timestamp,
        to: currentExport.at(-1)!.timestamp,
      })
      debug(`Added first export to chat log`)
      return
    }

    const currentExportEnd = currentExport.at(-1)!.timestamp
    const mergedMessagesEnd = merged.at(-1)!.timestamp
    if (currentExportEnd < mergedMessagesEnd) {
      // The time period covered by this export is already fully covered by the merged messages array
      debug(
        `Ignoring export ${filename} because it doesn't provide any new messages`
      )
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
        parts.at(-1)!.to = merged.at(-1)!.timestamp
        merged.push(...currentExport)
        parts.push({
          file: filename,
          from: merged.at(matchResult)!.timestamp,
          to: currentExport.at(-1)!.timestamp,
        })
        debug(
          `Added report (${filename}) to chat log, with start at index ${matchResult}`
        )
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
