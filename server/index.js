import './load-env.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  listDesignSystems,
  listLLMAdapters,
  aiAvailable,
  verifyApiKey,
  anthropicAdapter,
  jevAvailable,
  jevModel,
  verifyJevKey,
  sanitizeGoogleMapsKey,
  runWithGoogleMapsKey,
  layaAvailable,
  layaModel,
  decideBackend,
  decisionProviderPreference,
} from 'ui-compose-kit';
import { createGenerateLimiter, createFeedbackLimiter } from './rate-limits.js';
import { isHtmlPayloadError, sendHtmlTooLarge } from './generated-html-limit.js';
import { applyFeedback, storeAvailable, storeStatus } from './store.js';
import { mongoStatus, rateTurn } from './mongo.js';
import { registerAuthRoutes, oauthConfigured } from './auth.js';
import { registerChatRoutes } from './chat.js';
import { registerWidgetRoutes } from './widgets.js';
import { registerEmbedRoutes } from './embed.js';
import { registerDesignPackRoutes } from './design-packs.js';
import { planTurn } from './plan-turn.js';
import { planCache } from './plan-cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = process.env.VERCEL === '1';

const app = express();
if (isVercel) {
  app.set('trust proxy', 1);
}

/** Anthropic SDK errors carry the raw API JSON in `.message`; surface just its message text. */
function anthropicErrorMessage(error) {
  const raw = error?.message || 'Failed to render endpoint UI';
  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) return raw;
  try {
    const parsed = JSON.parse(raw.slice(jsonStart));
    return parsed?.error?.message || raw;
  } catch {
    return raw;
  }
}

const generateLimiter = createGenerateLimiter();
const feedbackLimiter = createFeedbackLimiter();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '512kb' }));
if (!isVercel) {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

app.get('/api/health', async (req, res) => {
  const [store, mongo] = await Promise.all([storeStatus(), mongoStatus()])
  const jevFromEnv = Boolean(process.env.TYPESAFE_API_KEY)
  const aiFromEnv = Boolean(
    process.env.ANTHROPIC_API_KEY
      || process.env.OPENAI_API_KEY
      || process.env.OPENAI_BASE_URL
      || process.env.GEMINI_API_KEY
      || process.env.GOOGLE_API_KEY,
  )
  const decisionBackend = decideBackend({})
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    jevFromEnv,
    aiFromEnv,
    ai: { available: aiAvailable(), fromEnv: aiFromEnv, model: anthropicAdapter.model },
    jev: { available: jevAvailable(), fromEnv: jevFromEnv, model: jevModel() },
    laya: {
      available: layaAvailable(),
      model: layaModel(),
      baseUrl: Boolean(process.env.LAYA_BASE_URL),
      mode: process.env.LAYA_MODE || (process.env.LAYA_BASE_URL ? 'http' : null),
    },
    decision: {
      preference: decisionProviderPreference(),
      backend: decisionBackend,
    },
    store,
    mongo,
    oauth: oauthConfigured(),
    maps: { configured: Boolean(sanitizeGoogleMapsKey(process.env.GOOGLE_MAPS_API_KEY)) },
    designSystems: listDesignSystems().map(({ id, active }) => ({ id, active })),
    llmProviders: listLLMAdapters(),
  });
});

app.get('/api/design-systems', (req, res) => {
  res.json({ designSystems: listDesignSystems() });
});

app.post('/api/verify-key', generateLimiter, async (req, res) => {
  const apiKey = req.get('x-anthropic-api-key') || req.body?.apiKey;
  res.json(await verifyApiKey(apiKey));
});

app.post('/api/verify-jev-key', generateLimiter, async (req, res) => {
  const apiKey = req.get('x-typesafe-api-key');
  res.json(await verifyJevKey(apiKey));
});

registerAuthRoutes(app);
registerChatRoutes(app, { generateLimiter });
registerWidgetRoutes(app, { generateLimiter });
registerEmbedRoutes(app);
registerDesignPackRoutes(app, { generateLimiter });

app.post('/api/render-endpoint', generateLimiter, async (req, res) => {
  try {
    const { url, method, headers, body, instructions, designSystem, llmProvider, sessionId } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    const apiKey = req.get('x-anthropic-api-key') || undefined;
    const typesafeApiKey = req.get('x-typesafe-api-key') || undefined;
    const cacheable = planCache.shouldCache({ apiKey, typesafeApiKey });
    const cacheKey = cacheable
      ? planCache.planKey({ url, instructions, designSystem, llmProvider })
      : null;
    if (cacheKey) {
      const hit = planCache.get(cacheKey);
      if (hit) return res.json({ ...hit, planCache: 'hit' });
    }
    const result = await runWithGoogleMapsKey(req.get('x-google-maps-api-key'), () => planTurn({
      url,
      method,
      headers,
      body,
      instructions,
      message: instructions,
      designSystem,
      llmProvider,
      sessionId,
      apiKey,
      typesafeApiKey,
    }));
    if (cacheKey) planCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    if (isHtmlPayloadError(error)) {
      return sendHtmlTooLarge(res, error);
    }
    const status = error.status || 500;
    if (status >= 500) console.error('Error rendering endpoint UI:', error);
    res.status(status).json({ error: anthropicErrorMessage(error) });
  }
});

app.post('/api/feedback', feedbackLimiter, async (req, res) => {
  try {
    const decisionId = req.body?.decisionId;
    const rating = req.body?.rating;
    const note = req.body?.note;
    if (!decisionId) return res.status(400).json({ error: 'decisionId is required' });
    if (rating !== 'up' && rating !== 'down') {
      return res.status(400).json({ error: 'rating must be "up" or "down"' });
    }
    await rateTurn({ decisionId, rating, note });
    if (!storeAvailable()) {
      return res.json({
        decisionId,
        replayEligible: rating === 'up',
        ratings: [{ rating, at: new Date().toISOString() }],
      });
    }
    const record = await applyFeedback({ decisionId, rating, note });
    res.json({
      decisionId: record.id,
      replayEligible: record.replayEligible,
      ratings: record.ratings,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('Error recording feedback:', error);
    res.status(status).json({ error: error.message || 'Failed to record feedback' });
  }
});

if (!isVercel) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
