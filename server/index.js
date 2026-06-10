import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';
import { createUIResource } from '@mcp-ui/server';
import {
  getDesignSystem,
  listDesignSystems,
  setActiveDesignSystem,
} from './design-systems/registry.js';
import { fetchEndpointData } from './data-source.js';
import { planUI, aiAvailable } from './ui-planner.js';
import { createGenerateLimiter } from './rate-limits.js';
import {
  assertGeneratedHtmlWithinLimit,
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
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '512kb' }));
if (!isVercel) {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    ai: { available: aiAvailable(), model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8' },
    designSystems: listDesignSystems().map(({ id, active }) => ({ id, active })),
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

// Serve React app for non-API routes (local / traditional hosting; Vercel ignores express.static)
if (!isVercel) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ service: 'mcp-ui-poc-api', health: '/api/health' });
  });
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

export default app;

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}
