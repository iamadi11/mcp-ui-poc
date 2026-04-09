import { createUIResource } from '@mcp-ui/server';
import {
  createFormHTML,
  createDashboardHTML,
  createChartHTML,
} from './dynamic-ui-html.js';
import { buildStructuredEnvelope } from './mcp-structured-ui.js';

// MCP Server for dynamic UI generation
export class MCPServer {
  constructor() {
    this.uiComponents = new Map();
    this.userData = new Map();
  }

  // Generate a form-based UI component
  async generateFormUI(userId, formConfig) {
    const formId = `form-${userId}-${Date.now()}`;
    
    const formHTML = createFormHTML(formConfig, formId);
    
    const resource = createUIResource({
      uri: `ui://dynamic/form/${formId}`,
      content: { 
        type: 'rawHtml', 
        htmlString: formHTML
      },
      encoding: 'text'
    });

    this.uiComponents.set(formId, { type: 'form', config: formConfig });
    return {
      ...resource,
      structured: buildStructuredEnvelope('form', formId, formConfig),
    };
  }

  // Generate a dashboard UI component
  async generateDashboardUI(userId, dashboardConfig) {
    const dashboardId = `dashboard-${userId}-${Date.now()}`;
    
    const dashboardHTML = createDashboardHTML(dashboardConfig, dashboardId);
    
    const resource = createUIResource({
      uri: `ui://dynamic/dashboard/${dashboardId}`,
      content: { 
        type: 'rawHtml', 
        htmlString: dashboardHTML
      },
      encoding: 'text'
    });

    this.uiComponents.set(dashboardId, { type: 'dashboard', config: dashboardConfig });
    return {
      ...resource,
      structured: buildStructuredEnvelope('dashboard', dashboardId, dashboardConfig),
    };
  }

  // Generate a data visualization UI component
  async generateChartUI(userId, chartConfig) {
    const chartId = `chart-${userId}-${Date.now()}`;
    
    const chartHTML = createChartHTML(chartConfig, chartId);
    
    const resource = createUIResource({
      uri: `ui://dynamic/chart/${chartId}`,
      content: { 
        type: 'rawHtml', 
        htmlString: chartHTML
      },
      encoding: 'text'
    });

    this.uiComponents.set(chartId, { type: 'chart', config: chartConfig });
    return {
      ...resource,
      structured: buildStructuredEnvelope('chart', chartId, chartConfig),
    };
  }

  /**
   * Store user data. Payloads with `kind: 'form-submit'` append to a capped list
   * so repeated demo submits are visible; other shapes replace the bucket (demo API).
   */
  storeUserData(userId, incoming) {
    if (incoming == null || typeof incoming !== 'object') {
      this.userData.set(userId, incoming);
      return;
    }
    if (incoming.kind !== 'form-submit') {
      this.userData.set(userId, incoming);
      return;
    }

    const prev = this.userData.get(userId);
    let submissions = [];

    if (prev && typeof prev === 'object') {
      if (Array.isArray(prev.submissions)) {
        submissions = prev.submissions.slice();
      } else if (prev.kind === 'form-submit') {
        submissions = [{ ...prev }];
      }
    }

    submissions.push({
      ...incoming,
      storedAt: new Date().toISOString(),
    });

    const maxSubmissions = 50;
    if (submissions.length > maxSubmissions) {
      submissions = submissions.slice(-maxSubmissions);
    }

    this.userData.set(userId, { submissions });
  }

  // Get user data
  getUserData(userId) {
    return this.userData.get(userId);
  }

  // Get component info
  getComponentInfo(componentId) {
    return this.uiComponents.get(componentId);
  }
} 