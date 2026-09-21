import { COMPONENT_CATALOG, renderSpecHtml } from './spec-html.js'
import { packToTheme, STARTER_PACKS, themeForRender } from './pack.js'

const theme = packToTheme(STARTER_PACKS.studio)

export const shadcnSystem = {
  id: 'shadcn',
  name: 'shadcn/ui',
  description: 'MASTER paper/ink surfaces, hairline cards, teal charts',
  components: COMPONENT_CATALOG,
  theme,
  pack: STARTER_PACKS.studio,
  render: (spec, themeOverride) => renderSpecHtml(spec, themeForRender(themeOverride, theme)),
}
