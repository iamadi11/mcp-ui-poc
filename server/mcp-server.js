import { randomUUID } from 'node:crypto';
import { createUIResource } from '@mcp-ui/server';
import {
  createFormHTML,
  createDashboardHTML,
  createChartHTML,
} from './dynamic-ui-html.js';
import { buildStructuredEnvelope } from './mcp-structured-ui.js';
import { assertGeneratedHtmlWithinLimit, MCP_MAX_HTML_BYTES } from './generated-html-limit.js';

/** Env-driven caps (min 1, max 1e6). Tuning helps long-lived demos and multi-tenant-ish traffic. */
function readLimitEnv(name, fallback) {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  const n = parseInt(String(raw), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(n, 1), 1_000_000)
}

const MCP_MAX_UI_COMPONENTS = readLimitEnv('MCP_MAX_UI_COMPONENTS', 2000)
const MCP_MAX_USER_DATA_KEYS = readLimitEnv('MCP_MAX_USER_DATA_KEYS', 500)
const MCP_MAX_SUBMISSIONS_PER_USER = readLimitEnv(
  'MCP_MAX_SUBMISSIONS_PER_USER',
  50
)

// MCP Server for dynamic UI generation
export class MCPServer {
  constructor() {
    this.uiComponents = new Map()
    this.userData = new Map()
  }

  getMcpStats() {
    return {
      uiComponentCount: this.uiComponents.size,
      userDataKeyCount: this.userData.size,
      limits: {
        maxUiComponents: MCP_MAX_UI_COMPONENTS,
        maxUserDataKeys: MCP_MAX_USER_DATA_KEYS,
        maxSubmissionsPerUser: MCP_MAX_SUBMISSIONS_PER_USER,
        maxHtmlBytes: MCP_MAX_HTML_BYTES,
      },
    }
  }

  _registerUiComponent(id, meta) {
    this.uiComponents.set(id, meta)
    while (this.uiComponents.size > MCP_MAX_UI_COMPONENTS) {
      const oldest = this.uiComponents.keys().next().value
      this.uiComponents.delete(oldest)
    }
  }

  _setUserData(userId, value) {
    this.userData.set(userId, value)
    while (this.userData.size > MCP_MAX_USER_DATA_KEYS) {
      const oldest = this.userData.keys().next().value
      this.userData.delete(oldest)
    }
  }

  // Generate a form-based UI component
  async generateFormUI(userId, formConfig) {
    const formId = `form-${userId}-${randomUUID()}`

    const formHTML = createFormHTML(formConfig, formId)
    assertGeneratedHtmlWithinLimit(formHTML)

    const resource = createUIResource({
      uri: `ui://dynamic/form/${formId}`,
      content: {
        type: 'rawHtml',
        htmlString: formHTML,
      },
      encoding: 'text',
    })

    this._registerUiComponent(formId, { type: 'form', config: formConfig })
    return {
      ...resource,
      structured: buildStructuredEnvelope('form', formId, formConfig),
    }
  }

  // Generate a dashboard UI component
  async generateDashboardUI(userId, dashboardConfig) {
    const dashboardId = `dashboard-${userId}-${randomUUID()}`

    const dashboardHTML = createDashboardHTML(dashboardConfig, dashboardId)
    assertGeneratedHtmlWithinLimit(dashboardHTML)

    const resource = createUIResource({
      uri: `ui://dynamic/dashboard/${dashboardId}`,
      content: {
        type: 'rawHtml',
        htmlString: dashboardHTML,
      },
      encoding: 'text',
    })

    this._registerUiComponent(dashboardId, {
      type: 'dashboard',
      config: dashboardConfig,
    })
    return {
      ...resource,
      structured: buildStructuredEnvelope(
        'dashboard',
        dashboardId,
        dashboardConfig
      ),
    }
  }

  // Generate a data visualization UI component
  async generateChartUI(userId, chartConfig) {
    const chartId = `chart-${userId}-${randomUUID()}`

    const chartHTML = createChartHTML(chartConfig, chartId)
    assertGeneratedHtmlWithinLimit(chartHTML)

    const resource = createUIResource({
      uri: `ui://dynamic/chart/${chartId}`,
      content: {
        type: 'rawHtml',
        htmlString: chartHTML,
      },
      encoding: 'text',
    })

    this._registerUiComponent(chartId, { type: 'chart', config: chartConfig })
    return {
      ...resource,
      structured: buildStructuredEnvelope('chart', chartId, chartConfig),
    }
  }

  // form-submit: append to capped list; other JSON: replace per-user bucket
  storeUserData(userId, incoming) {
    if (incoming == null || typeof incoming !== 'object') {
      this._setUserData(userId, incoming)
      return
    }
    if (incoming.kind !== 'form-submit') {
      this._setUserData(userId, incoming)
      return
    }

    const prev = this.userData.get(userId)
    let submissions = []

    if (prev && typeof prev === 'object') {
      if (Array.isArray(prev.submissions)) {
        submissions = prev.submissions.slice()
      } else if (prev.kind === 'form-submit') {
        submissions = [{ ...prev }]
      }
    }

    submissions.push({
      ...incoming,
      storedAt: new Date().toISOString(),
    })

    if (submissions.length > MCP_MAX_SUBMISSIONS_PER_USER) {
      submissions = submissions.slice(-MCP_MAX_SUBMISSIONS_PER_USER)
    }

    this._setUserData(userId, { submissions })
  }

  // Get user data
  getUserData(userId) {
    return this.userData.get(userId)
  }

  // Get component info
  getComponentInfo(componentId) {
    return this.uiComponents.get(componentId)
  }
}
