export const GLASS_STORAGE_KEY = 'mcp-ui-glass-settings-v1'

export const DEFAULT_GLASS = {
  blur: 20,
  frost: 55,
  border: 42,
  saturate: 165,
  mesh: 72,
  roundness: 48,
}

export function readStoredGlass() {
  try {
    const raw = localStorage.getItem(GLASS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_GLASS }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_GLASS, ...parsed }
  } catch {
    return { ...DEFAULT_GLASS }
  }
}

/**
 * Maps slider state to CSS custom properties for glass surfaces and mesh.
 * Call whenever settings or prefers-color-scheme changes.
 */
export function applyGlassCss(settings) {
  const root = document.documentElement
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const f = settings.frost / 100
  const b = settings.border / 100
  const mesh = settings.mesh / 100
  const scale = 0.72 + (settings.roundness / 100) * 0.56

  root.style.setProperty('--glass-blur', `${settings.blur}px`)
  root.style.setProperty('--glass-sat', `${settings.saturate}%`)
  root.style.setProperty('--mesh-strength', String(mesh))
  root.style.setProperty('--glass-radius-scale', String(scale))

  if (dark) {
    const fillA = 0.38 + f * 0.48
    root.style.setProperty('--glass-fill', `rgba(16, 16, 22, ${fillA})`)
    root.style.setProperty(
      '--glass-fill-subtle',
      `rgba(16, 16, 22, ${fillA * 0.72})`
    )
    root.style.setProperty(
      '--glass-border-color',
      `rgba(255, 255, 255, ${0.1 + b * 0.32})`
    )
    root.style.setProperty(
      '--glass-shadow',
      `0 16px 48px rgba(0, 0, 0, ${0.35 + f * 0.22})`
    )
    root.style.setProperty(
      '--glass-input-fill',
      `rgba(10, 10, 14, ${0.5 + f * 0.35})`
    )
  } else {
    const fillA = 0.42 + f * 0.5
    root.style.setProperty('--glass-fill', `rgba(255, 255, 255, ${fillA})`)
    root.style.setProperty(
      '--glass-fill-subtle',
      `rgba(255, 255, 255, ${fillA * 0.75})`
    )
    root.style.setProperty(
      '--glass-border-color',
      `rgba(255, 255, 255, ${0.45 + b * 0.4})`
    )
    root.style.setProperty(
      '--glass-shadow',
      `0 16px 48px rgba(31, 38, 135, ${0.1 + f * 0.18})`
    )
    root.style.setProperty(
      '--glass-input-fill',
      `rgba(255, 255, 255, ${0.62 + f * 0.28})`
    )
  }
}
