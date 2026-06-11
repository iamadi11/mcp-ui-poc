import { COMPONENT_CATALOG, renderSpecHtml } from './spec-html.js'

// Minimal unstyled-ish baseline. Useful as a template for registering
// your own design system: copy, restyle, registerDesignSystem().
const theme = {
  head: '',
  chartColors: ['#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed'],
  css: `
body{font-family:Georgia,'Times New Roman',serif;background:#fffdf8;color:#1c1917}
.card{border:1px solid #d6d3d1;padding:18px;background:#fff}
.stat{border-left:3px solid #2563eb;padding:8px 12px}
th{border-bottom:2px solid #1c1917}
td{border-bottom:1px solid #e7e5e4}
.record-list li{border-bottom:1px solid #e7e5e4;padding:8px 0}
.badge{border:1px solid #1c1917;padding:2px 8px;font-size:.75rem}
.bar-track{background:#f5f5f4;border:1px solid #e7e5e4}
`,
}

export const plainSystem = {
  id: 'plain',
  name: 'Plain (template)',
  description: 'Minimal serif baseline — copy this file to register a custom design system',
  components: COMPONENT_CATALOG,
  theme,
  render: (spec) => renderSpecHtml(spec, theme),
}
