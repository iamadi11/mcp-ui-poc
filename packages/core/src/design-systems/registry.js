/**
 * Design-system registry.
 *
 * A design system is registered at setup time and provides:
 *  - `components`: the catalog the AI planner may choose from (name + prop hints)
 *  - `theme`: { head, css, chartColors } passed to the shared spec-html renderer
 *  - `render(spec)`: turns a UI spec into a full HTML document
 *
 * Process default comes from MCP_DESIGN_SYSTEM (env) or the first registered system.
 * Request paths must pass an explicit designSystem id to getDesignSystem(id).
 * setActiveDesignSystem() is for tests/boot only — never expose it as a multi-user HTTP API.
 */
import { glassSystem } from './glass.js'
import { shadcnSystem } from './shadcn.js'
import { materialSystem } from './material.js'
import { plainSystem } from './plain.js'

const systems = new Map()
let activeId = null

export function registerDesignSystem(system) {
  if (!system?.id || typeof system.render !== 'function' || !Array.isArray(system.components)) {
    throw new Error('Design system requires id, components[], render()')
  }
  systems.set(system.id, system)
  if (!activeId) activeId = system.id
}

export function setActiveDesignSystem(id) {
  // Process-wide default only (tests / boot). Concurrent request paths must use getDesignSystem(id).
  if (!systems.has(id)) {
    throw new Error(`Unknown design system: ${id}. Registered: ${[...systems.keys()].join(', ')}`)
  }
  activeId = id
  return getDesignSystem(id)
}

export function getDesignSystem(id) {
  const system = systems.get(id || activeId)
  if (!system) throw new Error('No design system registered')
  return system
}

export function listDesignSystems() {
  return [...systems.values()].map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    components: s.components.map((c) => c.type),
    active: s.id === activeId,
  }))
}

// shadcn is the host ThemeAdapter default. Other systems stay swappable.
registerDesignSystem(shadcnSystem)
registerDesignSystem(glassSystem)
registerDesignSystem(materialSystem)
registerDesignSystem(plainSystem)

const envChoice = process.env.MCP_DESIGN_SYSTEM
if (envChoice && systems.has(envChoice)) {
  activeId = envChoice
}
