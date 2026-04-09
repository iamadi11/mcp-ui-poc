/**
 * Wraps generated MCP UI fragments in a full HTML document that matches the
 * client glass aesthetic (mesh backdrop, frosted card, DM Sans, accent blue).
 */
export function wrapGeneratedHtml(mainInnerHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Generated UI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet" />
  <style>${GENERATED_SKIN_CSS}</style>
</head>
<body class="gen-body">
  <div class="gen-mesh" aria-hidden="true"></div>
  <main class="gen-main">
    ${mainInnerHtml}
  </main>
</body>
</html>`
}

const GENERATED_SKIN_CSS = `
:root {
  color-scheme: light dark;
  --gen-accent: #2563eb;
  --gen-accent-soft: rgba(37, 99, 235, 0.18);
  --gen-text: #18181b;
  --gen-text-muted: #52525b;
  --gen-success: #16a34a;
  --gen-card: rgba(255, 255, 255, 0.52);
  --gen-card-border: rgba(255, 255, 255, 0.72);
  --gen-input: rgba(255, 255, 255, 0.72);
  --gen-shadow: 0 16px 48px rgba(31, 38, 135, 0.14);
  --gen-blur: 20px;
  --gen-sat: 165%;
}

@media (prefers-color-scheme: dark) {
  :root {
    --gen-text: #fafafa;
    --gen-text-muted: #a1a1aa;
    --gen-card: rgba(18, 18, 24, 0.72);
    --gen-card-border: rgba(255, 255, 255, 0.2);
    --gen-input: rgba(10, 10, 14, 0.75);
    --gen-shadow: 0 20px 56px rgba(0, 0, 0, 0.45);
    --gen-accent-soft: rgba(96, 165, 250, 0.2);
  }
}

*, *::before, *::after { box-sizing: border-box; }

.gen-body {
  margin: 0;
  min-height: 100vh;
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  color: var(--gen-text);
  background: linear-gradient(155deg, hsl(248 52% 94%) 0%, hsl(280 40% 92%) 38%, hsl(215 55% 93%) 100%);
  line-height: 1.55;
}

@media (prefers-color-scheme: dark) {
  .gen-body {
    background: linear-gradient(155deg, hsl(240 18% 7%) 0%, hsl(265 22% 10%) 45%, hsl(230 20% 8%) 100%);
  }
}

.gen-mesh {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.85;
  background:
    radial-gradient(ellipse 80% 60% at 15% 20%, rgba(120, 119, 255, 0.42), transparent 55%),
    radial-gradient(ellipse 70% 50% at 85% 15%, rgba(236, 72, 153, 0.26), transparent 50%),
    radial-gradient(ellipse 60% 45% at 50% 85%, rgba(56, 189, 248, 0.2), transparent 50%);
  animation: genMesh 26s ease-in-out infinite alternate;
}

@media (prefers-reduced-motion: reduce) {
  .gen-mesh { animation: none; }
}

@keyframes genMesh {
  0% { transform: scale(1) translate(0, 0); filter: hue-rotate(0deg); }
  100% { transform: scale(1.05) translate(-1%, 1%); filter: hue-rotate(10deg); }
}

.gen-main {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  padding: clamp(1rem, 4vw, 2rem);
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.gen-card {
  width: 100%;
  max-width: 640px;
  padding: clamp(1.25rem, 3vw, 2rem);
  border-radius: 14px;
  background: var(--gen-card);
  border: 1px solid var(--gen-card-border);
  box-shadow: var(--gen-shadow);
  backdrop-filter: blur(var(--gen-blur)) saturate(var(--gen-sat));
  -webkit-backdrop-filter: blur(var(--gen-blur)) saturate(var(--gen-sat));
}

.gen-card--wide { max-width: 880px; }

.gen-title {
  margin: 0 0 1.25rem;
  font-size: clamp(1.15rem, 2.8vw, 1.45rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  text-align: center;
  background: linear-gradient(125deg, var(--gen-text) 0%, var(--gen-accent) 110%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

@media (prefers-color-scheme: dark) {
  .gen-title {
    background: linear-gradient(125deg, #fafafa 0%, #93c5fd 100%);
    -webkit-background-clip: text;
    background-clip: text;
  }
}

.gen-actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;
}

.gen-btn {
  appearance: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.65rem 1.35rem;
  border-radius: 10px;
  color: #fff;
  background: var(--gen-accent);
  box-shadow: 0 4px 18px rgba(37, 99, 235, 0.3);
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
}

.gen-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
  box-shadow: 0 6px 22px rgba(37, 99, 235, 0.35);
}

.gen-btn--ghost {
  background: var(--gen-input);
  color: var(--gen-text);
  border: 1px solid var(--gen-card-border);
  box-shadow: none;
}

.gen-btn--amber {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  box-shadow: 0 4px 18px rgba(217, 119, 6, 0.35);
}

.gen-form-field { margin-bottom: 1.1rem; }

.gen-form-field label {
  display: block;
  margin-bottom: 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--gen-text-muted);
  letter-spacing: 0.02em;
}

.gen-form-field input,
.gen-form-field select,
.gen-form-field textarea {
  width: 100%;
  padding: 0.65rem 0.85rem;
  font-size: 0.95rem;
  color: var(--gen-text);
  border-radius: 10px;
  border: 1px solid var(--gen-card-border);
  background: var(--gen-input);
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.gen-form-field input:focus,
.gen-form-field select:focus,
.gen-form-field textarea:focus {
  outline: none;
  border-color: var(--gen-accent);
  box-shadow: 0 0 0 3px var(--gen-accent-soft);
}

.gen-form-field textarea { min-height: 110px; resize: vertical; }

.gen-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.gen-widget {
  padding: 1.1rem;
  border-radius: 12px;
  background: var(--gen-input);
  border: 1px solid var(--gen-card-border);
  backdrop-filter: blur(14px) saturate(150%);
  -webkit-backdrop-filter: blur(14px) saturate(150%);
}

.gen-widget h3 {
  margin: 0 0 0.65rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--gen-text);
}

.gen-metric-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--gen-accent);
  letter-spacing: -0.02em;
}

.gen-metric-label {
  font-size: 0.8rem;
  color: var(--gen-text-muted);
  margin-top: 0.2rem;
}

.gen-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.gen-list li {
  padding: 0.45rem 0;
  border-bottom: 1px solid var(--gen-card-border);
  font-size: 0.88rem;
  color: var(--gen-text-muted);
}

.gen-list li:last-child { border-bottom: none; }

.gen-chart-row {
  height: 220px;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  gap: 0.35rem;
  padding: 0.5rem 0;
}

.gen-bar {
  flex: 0 0 auto;
  width: 36px;
  min-height: 4px;
  border-radius: 8px 8px 4px 4px;
  background: linear-gradient(180deg, #60a5fa 0%, #2563eb 100%);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  padding-bottom: 4px;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}

.gen-chart-labels {
  display: flex;
  justify-content: space-around;
  margin-top: 0.65rem;
  gap: 0.25rem;
}

.gen-chart-labels span {
  font-size: 0.78rem;
  color: var(--gen-text-muted);
  text-align: center;
}

.gen-pie-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 260px;
}

.gen-pie {
  width: 200px;
  height: 200px;
  border-radius: 50%;
}

.gen-legend {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem 1rem;
  margin-top: 1rem;
}

.gen-legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: var(--gen-text-muted);
}

.gen-swatch {
  width: 11px;
  height: 11px;
  border-radius: 3px;
  flex-shrink: 0;
}

.gen-line-chart {
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
}

.gen-line-svg {
  width: 100%;
  height: 200px;
  display: block;
}

.gen-line-poly {
  fill: none;
  stroke: var(--gen-accent);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  stroke-linecap: round;
  stroke-linejoin: round;
}
`
