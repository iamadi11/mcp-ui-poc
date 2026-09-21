import { describe, it, expect } from 'vitest'
import { inferShape, fingerprint, shapeHash, cardinalityBucket } from '../src/shape.js'

const recordsA = [
  { id: 1, name: 'Alice', score: 10 },
  { id: 2, name: 'Bob', score: 20 },
]
const recordsB = [
  { id: 99, name: 'Zed', score: 500 },
  { id: 100, name: 'Yen', score: 1 },
  { id: 101, name: 'Xan', score: 2 },
]

describe('inferShape', () => {
  it('describes an array of records', () => {
    const shape = inferShape(recordsA)
    expect(shape.kind).toBe('array')
    expect(shape.rowsPath).toBe('')
    expect(shape.recordCount).toBe(2)
    expect(shape.fields.map((f) => f.key)).toEqual(['id', 'name', 'score'])
    expect(shape.fields.find((f) => f.key === 'score').numeric).toBe(true)
  })

  it('finds a nested record array', () => {
    const shape = inferShape({ results: recordsA, total: 2 })
    expect(shape.kind).toBe('array')
    expect(shape.rowsPath).toBe('results')
    expect(shape.recordCount).toBe(2)
  })

  it('zips Open-Meteo hourly parallel arrays into chartable rows', () => {
    const weather = {
      latitude: 28.6,
      longitude: 77.2,
      hourly: {
        time: ['2026-01-01T00:00', '2026-01-01T01:00', '2026-01-01T02:00'],
        temperature_2m: [18.2, 17.4, 16.9],
      },
    }
    const shape = inferShape(weather)
    expect(shape.kind).toBe('array')
    expect(shape.rowsPath).toBe('hourly')
    expect(shape.recordCount).toBe(3)
    expect(shape.fields.map((f) => f.key)).toEqual(['time', 'temperature_2m'])
    expect(shape.fields.find((f) => f.key === 'temperature_2m').numeric).toBe(true)
  })

  it('describes a plain object', () => {
    const shape = inferShape({ city: 'Delhi', temp: 32 })
    expect(shape.kind).toBe('object')
    expect(shape.fields.map((f) => f.key)).toEqual(['city', 'temp'])
  })
})

describe('fingerprint', () => {
  it('is stable when values change but the schema does not', () => {
    const a = inferShape(recordsA)
    const b = inferShape(recordsB)
    expect(fingerprint(a, 'show as a table', 'glass')).toBe(
      fingerprint(b, 'show as a table', 'glass'),
    )
    expect(shapeHash(a)).toBe(shapeHash(b))
  })

  it('changes when instructions or design system change', () => {
    const shape = inferShape(recordsA)
    expect(fingerprint(shape, 'as a table', 'glass')).not.toBe(
      fingerprint(shape, 'as a chart', 'glass'),
    )
    expect(fingerprint(shape, 'as a table', 'glass')).not.toBe(
      fingerprint(shape, 'as a table', 'shadcn'),
    )
    expect(fingerprint(shape, 'as a table', 'shadcn', 'pack-a')).not.toBe(
      fingerprint(shape, 'as a table', 'shadcn', 'pack-b'),
    )
  })
})

describe('cardinalityBucket', () => {
  it('buckets record counts', () => {
    expect(cardinalityBucket(0)).toBe('0')
    expect(cardinalityBucket(1)).toBe('1')
    expect(cardinalityBucket(8)).toBe('2-10')
    expect(cardinalityBucket(40)).toBe('11-50')
  })
})
