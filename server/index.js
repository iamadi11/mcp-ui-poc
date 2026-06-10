import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';
import { createUIResource } from '@mcp-ui/server';
import { createMCPUIExample } from './mcp-ui-example.js';
import {
  getDesignSystem,
  listDesignSystems,
  setActiveDesignSystem,
} from './design-systems/registry.js';
import { fetchEndpointData } from './data-source.js';
import { planUI, aiAvailable } from './ui-planner.js';
import { assertGeneratedHtmlWithinLimit } from './generated-html-limit.js';
import { MCPServer } from './mcp-server.js';
import { AIGenerator } from './ai-generator.js';
import {
  createGenerateLimiter,
  createStoreLimiter,
  createSuggestLimiter,
} from './rate-limits.js';
import {
  isHtmlPayloadError,
  sendHtmlTooLarge,
} from './generated-html-limit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = process.env.VERCEL === '1';

const app = express();
if (isVercel) {
  app.set('trust proxy', 1);
}

const generateLimiter = createGenerateLimiter();
const storeLimiter = createStoreLimiter();
const suggestLimiter = createSuggestLimiter();

const PORT = process.env.PORT || 3001;

// Initialize MCP Server and AI Generator
const mcpServer = new MCPServer();
const aiGenerator = new AIGenerator();

// Middleware
app.use(cors());
app.use(express.json({ limit: '512kb' }));
if (!isVercel) {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    mcp: mcpServer.getMcpStats(),
    ai: { available: aiAvailable(), model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8' },
  });
});

// Design-system registry (registered at setup; see server/design-systems/registry.js)
app.get('/api/design-systems', (req, res) => {
  res.json({ designSystems: listDesignSystems() });
});

app.post('/api/design-systems/active', (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });
    setActiveDesignSystem(id);
    res.json({ designSystems: listDesignSystems() });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Endpoint → data → AI analysis → design-system components → MCP UI resource
app.post('/api/render-endpoint', generateLimiter, async (req, res) => {
  try {
    const { url, method, headers, body, instructions, designSystem: dsId } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });

    const designSystem = getDesignSystem(dsId);
    const { data, contentType, bytes } = await fetchEndpointData({ url, method, headers, body });
    const { spec, planner } = await planUI({ data, sourceUrl: url, instructions, designSystem });

    const html = designSystem.render(spec);
    assertGeneratedHtmlWithinLimit(html);

    const componentId = `endpoint-${randomUUID()}`;
    const resource = createUIResource({
      uri: `ui://endpoint/${componentId}`,
      content: { type: 'rawHtml', htmlString: html },
      encoding: 'text',
    });

    res.json({
      ...resource,
      componentId,
      spec,
      meta: {
        planner,
        designSystem: designSystem.id,
        source: { url, contentType, bytes },
      },
    });
  } catch (error) {
    if (isHtmlPayloadError(error)) {
      return sendHtmlTooLarge(res, error);
    }
    const status = error.status || 500;
    if (status >= 500) console.error('Error rendering endpoint UI:', error);
    res.status(status).json({ error: error.message || 'Failed to render endpoint UI' });
  }
});

// MCP UI Example endpoint
app.get('/api/mcp-ui-example', async (req, res) => {
  try {
    const result = await createMCPUIExample();
    res.json(result);
  } catch (error) {
    if (isHtmlPayloadError(error)) {
      return sendHtmlTooLarge(res, error);
    }
    console.error('Error creating MCP UI example:', error);
    res.status(500).json({ error: 'Failed to create MCP UI example' });
  }
});

// AI-Powered Component Generation
app.post('/api/ai/generate', generateLimiter, async (req, res) => {
  try {
    const { userId, description } = req.body;
    
    if (!userId || !description) {
      return res.status(400).json({ error: 'userId and description are required' });
    }
    
    console.log('AI Generation request:', { userId, description });
    
    const result = await aiGenerator.generateFromDescription(userId, description);
    res.json(result);
  } catch (error) {
    if (isHtmlPayloadError(error)) {
      return sendHtmlTooLarge(res, error);
    }
    console.error('Error generating AI component:', error);
    res.status(500).json({ error: 'Failed to generate AI component' });
  }
});

// AI Component Templates
app.get('/api/ai/templates', (req, res) => {
  try {
    const templates = Array.from(aiGenerator.componentTemplates.entries()).map(([key, template]) => ({
      type: key,
      description: template.description
    }));
    
    res.json({ templates });
  } catch (error) {
    console.error('Error getting AI templates:', error);
    res.status(500).json({ error: 'Failed to get AI templates' });
  }
});

// AI Component Suggestions
app.post('/api/ai/suggest', suggestLimiter, (req, res) => {
  try {
    const { description } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }
    
    const suggestions = aiGenerator.getSuggestions(description);
    res.json({ suggestions });
  } catch (error) {
    console.error('Error getting AI suggestions:', error);
    res.status(500).json({ error: 'Failed to get AI suggestions' });
  }
});

// Dynamic UI Generation Endpoints
app.post('/api/generate-form', generateLimiter, async (req, res) => {
  try {
    const { userId, formConfig } = req.body;
    
    if (!userId || !formConfig) {
      return res.status(400).json({ error: 'userId and formConfig are required' });
    }
    
    const result = await mcpServer.generateFormUI(userId, formConfig);
    res.json(result);
  } catch (error) {
    if (isHtmlPayloadError(error)) {
      return sendHtmlTooLarge(res, error);
    }
    console.error('Error generating form UI:', error);
    res.status(500).json({ error: 'Failed to generate form UI' });
  }
});

app.post('/api/generate-dashboard', generateLimiter, async (req, res) => {
  try {
    const { userId, dashboardConfig } = req.body;
    
    if (!userId || !dashboardConfig) {
      return res.status(400).json({ error: 'userId and dashboardConfig are required' });
    }
    
    const result = await mcpServer.generateDashboardUI(userId, dashboardConfig);
    res.json(result);
  } catch (error) {
    if (isHtmlPayloadError(error)) {
      return sendHtmlTooLarge(res, error);
    }
    console.error('Error generating dashboard UI:', error);
    res.status(500).json({ error: 'Failed to generate dashboard UI' });
  }
});

app.post('/api/generate-chart', generateLimiter, async (req, res) => {
  try {
    const { userId, chartConfig } = req.body;
    
    if (!userId || !chartConfig) {
      return res.status(400).json({ error: 'userId and chartConfig are required' });
    }
    
    const result = await mcpServer.generateChartUI(userId, chartConfig);
    res.json(result);
  } catch (error) {
    if (isHtmlPayloadError(error)) {
      return sendHtmlTooLarge(res, error);
    }
    console.error('Error generating chart UI:', error);
    res.status(500).json({ error: 'Failed to generate chart UI' });
  }
});

// Data storage endpoints
app.post('/api/store-data', storeLimiter, (req, res) => {
  try {
    const { userId, data } = req.body;
    
    if (!userId || !data) {
      return res.status(400).json({ error: 'userId and data are required' });
    }
    
    mcpServer.storeUserData(userId, data);
    res.json({ success: true, message: 'Data stored successfully' });
  } catch (error) {
    console.error('Error storing data:', error);
    res.status(500).json({ error: 'Failed to store data' });
  }
});

app.get('/api/get-data/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const data = mcpServer.getUserData(userId);
    
    if (!data) {
      return res.status(404).json({ error: 'User data not found' });
    }
    
    res.json({ data });
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});

// Component info endpoint
app.get('/api/component-info/:componentId', (req, res) => {
  try {
    const { componentId } = req.params;
    const info = mcpServer.getComponentInfo(componentId);
    
    if (!info) {
      return res.status(404).json({ error: 'Component not found' });
    }
    
    res.json({ info });
  } catch (error) {
    console.error('Error retrieving component info:', error);
    res.status(500).json({ error: 'Failed to retrieve component info' });
  }
});

// Serve React app for non-API routes (local / traditional hosting only; Vercel ignores express.static)
if (!isVercel) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      service: 'mcp-ui-poc-api',
      health: '/api/health',
    });
  });
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

export default app;

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 API available at http://localhost:${PORT}/api`);
    console.log(`🤖 AI Generator ready at http://localhost:${PORT}/api/ai`);
  });
} 