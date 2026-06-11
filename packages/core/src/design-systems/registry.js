/**
 * Design-system registry.
 *
 * A design system is registered at setup time and provides:
 *  - `components`: the catalog the AI planner may choose from (name + prop hints)
 *  - `theme`: { head, css, chartColors } passed to the shared spec-html renderer
 *  - `render(spec)`: turns a UI spec into a full HTML document
 *
 * The active system is selected via MCP_DESIGN_SYSTEM (env) or setActiveDesignSystem().
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

// Built-in setup registration. Add custom systems here or call registerDesignSystem()
// from your own setup module before the server starts handling requests.
// "glass" registers first so it's the default active system.
registerDesignSystem(glassSystem)
registerDesignSystem(shadcnSystem)
registerDesignSystem(materialSystem)
registerDesignSystem(plainSystem)

const envChoice = process.env.MCP_DESIGN_SYSTEM
if (envChoice && systems.has(envChoice)) {
  activeId = envChoice
}
