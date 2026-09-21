import { describe, it, expect } from 'vitest'
import { uiSpecSchema, componentSchema, propsSchema, workspaceUiSpecSchema } from '../src/schema.js'

describe('schema', () => {
  it('uiSpecSchema includes the component presentation mode', () => {
    expect(uiSpecSchema.properties.presentation.enum).toEqual(['page', 'modal', 'component'])
  })

  it('componentSchema requires type and props with no extra keys', () => {
    expect(componentSchema.properties.type.enum).toContain('work-stage')
    expect(componentSchema.required).toEqual(['type', 'props'])
    expect(componentSchema.additionalProperties).toBe(false)
  })

  it('propsSchema has 14 component-prop variants, each closed', () => {
    expect(propsSchema.anyOf).toHaveLength(14)
    for (const variant of propsSchema.anyOf) {
      expect(variant.additionalProperties).toBe(false)
    }
  })

  it('workspaceUiSpecSchema only allows work-stage so Haiku can plan map UIs', () => {
    expect(workspaceUiSpecSchema.properties.components.items.properties.type.enum).toEqual(['work-stage'])
    expect(workspaceUiSpecSchema.properties.presentation.enum).toEqual(['page'])
  })
})
