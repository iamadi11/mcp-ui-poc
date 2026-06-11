import { COMPONENT_CATALOG, renderSpecHtml } from './spec-html.js'

// Glassmorphism theme — mirrors the host shell's --shell-* tokens (blur,
// saturation, translucent fills, mesh-gradient backdrop) so generated UI
// reads as part of the same surface as the website around it.
const theme = {
  head: '',
  chartColors: ['#6d6dff', '#ec4899', '#38bdf8', '#a855f7', '#fbbf24', '#34d399'],
  css: `
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  color:#1c1917;
  background:linear-gradient(155deg, hsl(248 52% 94%) 0%, hsl(280 40% 92%) 38%, hsl(215 55% 93%) 100%);
  position:relative;
}
body::before{
  content:'';
  position:fixed;
  inset:0;
  z-index:-1;
  pointer-events:none;
  opacity:0.85;
  background:
    radial-gradient(ellipse 80% 60% at 15% 20%, rgba(120, 119, 255, 0.45), transparent 55%),
    radial-gradient(ellipse 70% 50% at 85% 15%, rgba(236, 72, 153, 0.28), transparent 50%),
    radial-gradient(ellipse 60% 45% at 50% 85%, rgba(56, 189, 248, 0.22), transparent 50%);
}
.card{
  background:rgba(255, 255, 255, 0.65);
  border:1px solid rgba(255, 255, 255, 0.72);
  border-radius:14px;
  padding:18px;
  box-shadow:0 16px 48px rgba(31, 38, 135, 0.18);
  backdrop-filter:blur(20px) saturate(165%);
  -webkit-backdrop-filter:blur(20px) saturate(165%);
}
.stat{
  background:rgba(255, 255, 255, 0.48);
  border:1px solid rgba(255, 255, 255, 0.72);
  border-radius:10px;
  padding:12px;
  backdrop-filter:blur(20px) saturate(165%);
  -webkit-backdrop-filter:blur(20px) saturate(165%);
}
th{border-bottom:1px solid rgba(255, 255, 255, 0.72);color:#57534e;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em}
td{border-bottom:1px solid rgba(255, 255, 255, 0.4)}
.record-list li{
  background:rgba(255, 255, 255, 0.48);
  border:1px solid rgba(255, 255, 255, 0.72);
  border-radius:10px;
  padding:10px 12px;
  backdrop-filter:blur(20px) saturate(165%);
  -webkit-backdrop-filter:blur(20px) saturate(165%);
}
.badge{
  border:1px solid rgba(255, 255, 255, 0.72);
  border-radius:9999px;
  padding:3px 10px;
  font-size:.74rem;
  font-weight:500;
  background:rgba(255, 255, 255, 0.48);
}
.bar-track{background:rgba(255, 255, 255, 0.4)}
.modal-backdrop{background:rgba(20, 20, 30, 0.35);backdrop-filter:blur(6px)}
@media (prefers-color-scheme: dark){
  body{
    color:#fafafa;
    background:linear-gradient(155deg, hsl(240 18% 7%) 0%, hsl(265 22% 10%) 45%, hsl(230 20% 8%) 100%);
  }
  .card,.stat,.record-list li{
    background:rgba(16, 16, 22, 0.72);
    border-color:rgba(255, 255, 255, 0.24);
    box-shadow:0 16px 48px rgba(0, 0, 0, 0.55);
  }
  th{border-color:rgba(255, 255, 255, 0.24);color:#a1a1aa}
  td{border-color:rgba(255, 255, 255, 0.12)}
  .badge{background:rgba(16, 16, 22, 0.55);border-color:rgba(255, 255, 255, 0.24)}
  .bar-track{background:rgba(255, 255, 255, 0.12)}
}
`,
}

export const glassSystem = {
  id: 'glass',
  name: 'Glass',
  description: 'Glassmorphism: blurred translucent surfaces matching the host app shell',
  components: COMPONENT_CATALOG,
  theme,
  render: (spec) => renderSpecHtml(spec, theme),
}
