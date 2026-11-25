import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

// A tool-level error the model sees and can react to (not a protocol error).
export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

// Escape LIKE metacharacters so the caller's `%`/`_` are matched literally.
export function ilikePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`
}
