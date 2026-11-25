import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

// Tool results are compact JSON as text — easy for the model to read and quote.
export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

// A tool-level error the model can see and react to (e.g. a validation message),
// as opposed to a protocol error.
export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

// ISO date (yyyy-MM-dd) as used everywhere in the planner.
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// Escape PostgREST ilike wildcards so user text is matched literally.
export function ilikePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}
