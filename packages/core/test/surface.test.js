import { describe, it, expect } from 'vitest'
import { classifySurface, workspaceFixture, isProductSurface, titleFromPrompt, catalogCannotExpress } from '../src/surface.js'

describe('classifySurface', () => {
  it('routes a polygon/maps prompt to a catalog map workspace', () => {
    const surface = classifySurface('create a polygon generator on google maps layer')
    expect(surface.kind).toBe('tool')
    expect(surface.main).toBe('map')
    expect(surface.catalog).toBe(true)
    expect(surface.tools).toContain('polygon')
    const data = workspaceFixture('create a polygon generator on google maps layer', surface)
    expect(data.mode).toBe('map')
    expect(JSON.stringify(data)).not.toMatch(/Primary/)
    expect(isProductSurface(surface)).toBe(true)
  })

  it('classifies landing and checkout as product primitives, not records', () => {
    expect(classifySurface('Create a landing page for a shoes store').main).toBe('landing-page')
    expect(classifySurface('Create a checkout for a shoes store').main).toBe('checkout')
    expect(classifySurface('Show pricing plans').main).toBe('pricing')
  })

  it('keeps API dashboards on the records path', () => {
    const surface = classifySurface('Create a dashboard from this API', 'https://api.open-meteo.com/forecast')
    expect(surface.kind).toBe('records')
    expect(isProductSurface(surface)).toBe(false)
  })

  it('does not let the word dashboard steal a Google Maps polygon ask into records', () => {
    const prompt =
      'can you create me a dashboard using google maps and shadcn where user can create polygons on google map'
    const surface = classifySurface(prompt)
    expect(surface.kind).toBe('tool')
    expect(surface.main).toBe('map')
    expect(surface.catalog).toBe(true)
    expect(surface.tools).toContain('polygon')
    const data = workspaceFixture(prompt, surface)
    expect(data.mode).toBe('map')
    expect(JSON.stringify(data)).not.toMatch(/Primary/)
  })

  it('keeps articles attached to words like account', () => {
    expect(titleFromPrompt('Create account settings')).toBe('Account settings')
    expect(titleFromPrompt('Create a login page')).toBe('Login page')
  })

  it('classifies contact forms, settings, and calendars as catalog primitives', () => {
    expect(classifySurface('Create a contact form').main).toBe('form')
    expect(classifySurface('Create account settings').main).toBe('settings')
    expect(classifySurface('Create a calendar for team events').main).toBe('calendar')
    expect(isProductSurface(classifySurface('Create a contact form'))).toBe(false)
  })

  it('sends branded graffiti checkouts out of catalog so Haiku can generate them', () => {
    const prompt = 'Can you create checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.'
    expect(catalogCannotExpress(prompt)).toBe(true)
    const surface = classifySurface(prompt)
    expect(surface.catalog).toBe(false)
    expect(surface.main).toBe('generated')
  })

  it('sends named-brand login out of catalog so Haiku can brand the form', () => {
    const prompt = 'create a login page for Tata 1mg'
    expect(catalogCannotExpress(prompt)).toBe(true)
    const surface = classifySurface(prompt)
    expect(surface.catalog).toBe(false)
    expect(surface.main).toBe('generated')
  })

  it('keeps generic login in catalog', () => {
    const prompt = 'create a login page'
    expect(catalogCannotExpress(prompt)).toBe(false)
    expect(classifySurface(prompt).catalog).toBe(true)
    expect(classifySurface(prompt).main).toBe('form')
  })

  it('shortens clothing checkout titles to Brand checkout', () => {
    expect(titleFromPrompt('create checkout for clothing brand Snitch, graffiti animation on load'))
      .toMatch(/^Snitch checkout$/i)
    expect(titleFromPrompt('Clothing brand Snitch, graffiti animation on load'))
      .toMatch(/^Snitch checkout$/i)
  })

  it('sends tic-tac-toe and other games out of catalog instead of a workspace board', () => {
    const prompt = 'Create a game of tic tac toe with heavy animation.'
    expect(catalogCannotExpress(prompt)).toBe(true)
    const surface = classifySurface(prompt)
    expect(surface.catalog).toBe(false)
    expect(surface.kind).not.toBe('tool')
    expect(surface.main).toBe('generated')
    expect(isProductSurface(surface)).toBe(false)
  })
})