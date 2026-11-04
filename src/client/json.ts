/** Small JSON helpers shared by the log model and the views. */

/** Narrow an unknown JSON value to an object without asserting its fields. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse recorded argument JSON.
 *
 * Arguments arrive as a string and may still be incomplete while a call streams,
 * so anything that does not parse is treated as "no arguments yet".
 */
export function parseArguments(raw: string): Record<string, unknown> {
  if (raw === '') return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}
