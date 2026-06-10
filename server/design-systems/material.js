import { COMPONENT_CATALOG, renderSpecHtml } from './spec-html.js'

// Material Design 3 flavored theme: Roboto, tonal surfaces, elevation shadows,
// filled chips and M3 primary palette.
const theme = {
  head: `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">`,
  chartColors: ['#6750a4', '#7d5260', '#625b71', '#9a82db', '#b58392', '#8b80a0'],
  css: `
body{font-family:Roboto,system-ui,sans-serif;background:#fef7ff;color:#1d1b20}
.card{background:#fff;border-radius:16px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.08)}
.section-title{color:#6750a4;text-transform:none;font-size:1rem}
.stat{background:#eaddff;border-radius:12px;padding:14px;color:#21005d}
.stat-value{color:#21005d}
th{border-bottom:2px solid #e7e0ec;color:#49454f;font-size:.78rem}
td{border-bottom:1px solid #f3edf7}
.record-list li{background:#f7f2fa;border-radius:12px;padding:12px 14px}
.badge{background:#e8def8;color:#1d192b;border-radius:8px;padding:4px 12px;font-size:.76rem;font-weight:500}
.bar-track{background:#e7e0ec}
h1{color:#1d1b20;font-weight:500}
`,
}

export const materialSystem = {
  id: 'material',
  name: 'Material UI',
  description: 'Material Design 3: Roboto, tonal surfaces, elevation, M3 palette',
  components: COMPONENT_CATALOG,
  render: (spec) => renderSpecHtml(spec, theme),
}
