/**
 * Versioned envelopes for data-driven MCP UI previews (JSON config + client renderers).
 * HTML from createUIResource remains the transport for MCP iframe hosts; the API also
 * returns `structured` so this app can render without an iframe.
 */
export const STRUCTURED_UI_SCHEMA_VERSION = 1

/**
 * @param {'form'|'dashboard'|'chart'} kind
 * @param {string} id
 * @param {object} config
 */
export function buildStructuredEnvelope(kind, id, config) {
  return {
    schemaVersion: STRUCTURED_UI_SCHEMA_VERSION,
    kind,
    id,
    config,
  }
}
