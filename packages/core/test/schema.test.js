import { describe, it, expect } from 'vitest'
import { uiSpecSchema, componentSchema, propsSchema } from '../src/schema.js'

describe('schema', () => {
  it('uiSpecSchema includes the component presentation mode', () => {
    expect(uiSpecSchema.properties.presentation.enum).toEqual(['page', 'modal', 'component'])
  })

  it('componentSchema requires type and props with no extra keys', () => {
    expect(componentSchema.required).toEqual(['type', 'props'])
    expect(componentSchema.additionalProperties).toBe(false)
  })

  it('propsSchema has 9 component-prop variants, each closed', () => {
    expect(propsSchema.anyOf).toHaveLength(9)
    for (const variant of propsSchema.anyOf) {
      expect(variant.additionalProperties).toBe(false)
    }
  })
})
