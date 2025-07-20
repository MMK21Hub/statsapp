import { config } from "./args.js"
import { Message, MessageType, MessageContent, PersonOptions } from "./types.js"
import { parseFormattedTime, debug } from "./util.js"

const chatExportParser =
  /^(\d{2}\/\d{2}\/\d{4}), (\d{1,2}:\d{2} ?[ap]?m?) - (.*): (.*)/gm
const contactNameExtractor =
  /(?<=^\d{2}\/\d{2}\/\d{4}, \d{1,2}:\d{2} ?[ap]?m? - ).*(?=: .*)/gm
const editedMessageSuffix = " " + "<This message was edited>"
const editedMessageSuffixRegex = new RegExp(`${editedMessageSuffix}$`)

/**
 * Parses a chat export file from WhatsApp. Doesn't work with messages that contain newlines.
 * Ignores system messages.
 * @returns an array of messages
 */
export function parseChatExport(exportData: string) {
  const startTime = process.hrtime()
  const messages: Message[] = []

  let match: RegExpMatchArray | null = chatExportParser.exec(exportData)
  while ((match = chatExportParser.exec(exportData))) {
    const [fullMatch, dateString, timeString, name, rawContent] = match!
    const nameConfig = getNameConfig(name)
    if (!nameConfig.include) continue
    const [day, month, year] = dateString.split("/").map((num) => parseInt(num))
    const dateIndexes = [year, month - 1, day] as const
    const dateTime = new Date(...dateIndexes, ...parseFormattedTime(timeString))
    const dateISO = dateTime.toISOString().split("T")[0]
    const normalName = nameConfig.preferredName
    const firstName = normalName.split(" ")[0]

    const { type, content } = parseMessageContent(rawContent)

    messages.push({
      type,
      content,
      fullName: normalName,
      firstName,
      timestamp: dateTime,
      dateISO,
      raw: fullMatch,
    })
  }

  const [timeSecs, timeNanosecs] = process.hrtime(startTime)
  const milliseconds = (timeNanosecs + timeSecs * 10 ** 9) / 10 ** 6

  debug(`Parsed ${messages.length} messages in ${milliseconds.toFixed(1)} ms`)
  return messages
}

function getNameConfig(
  inputName: string
): PersonOptions & { preferredName: string } {
  const personConfig = Object.entries(config.people).find(([_, options]) =>
    new RegExp(options.match).test(inputName)
  )
  // Default config (we include people by default)
  if (!personConfig)
    return {
      preferredName: inputName.trim(),
      match: inputName,
      include: true,
    }
  // Return the options and include the name that the person should be normalized to
  const [preferredName, options] = personConfig
  return {
    preferredName,
    ...options,
  }
}

function parseMessageContent(rawContent: string): {
  type: MessageType
  content?: MessageContent
} {
  if (rawContent === "POLL:")
    return {
      type: MessageType.Poll,
    }
  if (rawContent === "<Media omitted>")
    return {
      type: MessageType.Media,
    }
  if (rawContent === "null")
    // WhatsApp weirdness: "View once" media just gets exported as the string "null"
    return {
      type: MessageType.ViewOnceMedia,
    }
  if (
    rawContent === "This message was deleted" ||
    rawContent === "You deleted this message"
  )
    return {
      type: MessageType.Deleted,
    }

  const isEdited = rawContent.endsWith(editedMessageSuffix)
  const messageContent = isEdited
    ? rawContent.replace(editedMessageSuffixRegex, "")
    : rawContent

  return {
    type: MessageType.Normal,
    content: {
      text: messageContent,
      edited: isEdited,
    },
  }
}

export function messagesToChatLog(messages: Message[]) {
  const allowedMessageTypes = [MessageType.Normal, MessageType.Media]

  return messages
    .filter((msg) => allowedMessageTypes.includes(msg.type))
    .map((msg) => {
      if (msg.content?.edited) debugger
      return msg.raw
        .replace(
          contactNameExtractor,
          (name) => getNameConfig(name).preferredName
        )
        .replace(editedMessageSuffixRegex, "")
    })
    .join("\n")
}
