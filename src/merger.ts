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

export function mergeExports(exports: Message[][]) {
  // TODO Implement me
}
