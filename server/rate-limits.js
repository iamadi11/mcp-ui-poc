import rateLimit from 'express-rate-limit';

function readPositiveInt(name, defaultValue) {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultValue;
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) return defaultValue;
  return n;
}

function json429(message) {
  return (req, res) => {
    res.status(429).json({ error: message, code: 'RATE_LIMIT' });
  };
}

const windowMs = 60_000;

/** CPU-heavy MCP HTML generation + AI full generation */
export function createGenerateLimiter() {
  const max = readPositiveInt('MCP_RATE_LIMIT_GENERATE_PER_MIN', 45);
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: json429('Too many generate requests; slow down and try again shortly.'),
  });
}

/** Form submissions / store-data (can be frequent in demos) */
export function createStoreLimiter() {
  const max = readPositiveInt('MCP_RATE_LIMIT_STORE_PER_MIN', 180);
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: json429('Too many store requests; slow down and try again shortly.'),
  });
}

/** Lightweight AI suggest */
export function createSuggestLimiter() {
  const max = readPositiveInt('MCP_RATE_LIMIT_SUGGEST_PER_MIN', 60);
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: json429('Too many suggestion requests; slow down and try again shortly.'),
  });
}
