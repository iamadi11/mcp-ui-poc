import { COMPONENT_CATALOG, renderSpecHtml } from './spec-html.js'

// shadcn/ui-flavored theme: neutral zinc palette, Inter-adjacent stack,
// subtle borders + radius matching shadcn semantic tokens.
const theme = {
  head: '',
  chartColors: ['#18181b', '#3f3f46', '#71717a', '#a1a1aa', '#52525b', '#27272a'],
  css: `
:root{color-scheme:light dark}
body{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;background:#fafafa;color:#09090b}
.card{background:#fff;border:1px solid #e4e4e7;border-radius:10px;padding:18px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.stat{border:1px solid #e4e4e7;border-radius:8px;padding:12px;background:#fff}
th{border-bottom:1px solid #e4e4e7;color:#71717a;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em}
td{border-bottom:1px solid #f4f4f5}
.record-list li{border:1px solid #e4e4e7;border-radius:8px;padding:10px 12px;background:#fff}
.badge{border:1px solid #e4e4e7;border-radius:9999px;padding:3px 10px;font-size:.74rem;font-weight:500;background:#f4f4f5}
.bar-track{background:#f4f4f5}
@media (prefers-color-scheme: dark){
  body{background:#09090b;color:#fafafa}
  .card,.stat,.record-list li{background:#18181b;border-color:#27272a}
  th{border-color:#27272a}
  td{border-color:#1f1f23}
  .badge{background:#27272a;border-color:#3f3f46}
  .bar-track{background:#27272a}
}
`,
}

export const shadcnSystem = {
  id: 'shadcn',
  name: 'shadcn/ui',
  description: 'Neutral zinc palette, bordered cards, shadcn semantic styling',
  components: COMPONENT_CATALOG,
  render: (spec) => renderSpecHtml(spec, theme),
}
