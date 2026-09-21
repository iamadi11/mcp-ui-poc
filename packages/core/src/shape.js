/**
 * Data-shape summary and cache keys. Fingerprints ignore payload values so the
 * same schema + instructions replay even when record contents change.
 */
import { createHash } from 'node:crypto'

const FIELD_CAP = 20

export function getPath(data, path) {
  if (path == null || path === '') return data
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc == null ? acc : acc[key]), data)
}

export function normalizeInstructions(instructions) {
  return String(instructions || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function cardinalityBucket(n) {
  const count = Number(n) || 0
  if (count <= 0) return '0'
  if (count === 1) return '1'
  if (count <= 10) return '2-10'
  if (count <= 50) return '11-50'
  if (count <= 200) return '51-200'
  return '200+'
}

function valueType(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  const t = typeof value
  return t === 'object' ? 'object' : t
}

export function zipSeriesObject(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const series = Object.entries(obj).filter(([, value]) => {
    if (!Array.isArray(value) || value.length < 2) return false
    const first = value.find((item) => item != null)
    return first == null || typeof first !== 'object'
  })
  if (!series.length) return null
  const len = Math.max(...series.map(([, value]) => value.length))
  const usable = series.filter(([, value]) => value.length === len)
  if (!usable.length) return null
  const rowCount = Math.min(len, 200)
  const rows = []
  for (let i = 0; i < rowCount; i += 1) {
    const row = {}
    for (const [key, values] of usable) row[key] = values[i] ?? null
    rows.push(row)
  }
  return rows
}

export function rowsFromValue(value) {
  if (Array.isArray(value)) {
    if (value.length && typeof value[0] === 'object' && value[0] !== null && !Array.isArray(value[0])) {
      return value
    }
    if (value.length && (value[0] == null || typeof value[0] !== 'object')) {
      return value.map((item, index) => ({ index, value: item }))
    }
    return null
  }
  return zipSeriesObject(value)
}

export function findRows(data, prefix = '') {
  if (Array.isArray(data)) {
    const rows = rowsFromValue(data)
    if (rows) return { rows, rowsPath: prefix, series: !data[0] || typeof data[0] !== 'object' }
  }
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value) && value.length && typeof value[0] === 'object' && value[0] !== null && !Array.isArray(value[0])) {
        const rowsPath = prefix ? `${prefix}.${key}` : key
        return { rows: value, rowsPath, series: false }
      }
    }
    const zipped = zipSeriesObject(data)
    if (zipped) {
      return { rows: zipped, rowsPath: prefix, series: true }
    }
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = findRows(value, prefix ? `${prefix}.${key}` : key)
        if (nested.rows) return nested
      }
    }
  }
  return { rows: null, rowsPath: null, series: false }
}

function fieldsFromRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return []
  return Object.entries(record)
    .slice(0, FIELD_CAP)
    .map(([key, value]) => {
      const type = valueType(value)
      return {
        key,
        type,
        numeric: type === 'number',
        string: type === 'string',
      }
    })
}

export function inferShape(data) {
  if (Array.isArray(data)) {
    const sample = data.find((row) => row && typeof row === 'object' && !Array.isArray(row)) || data[0]
    const fields = fieldsFromRecord(sample)
    return {
      kind: 'array',
      rowsPath: '',
      recordCount: data.length,
      cardinality: cardinalityBucket(data.length),
      fields,
    }
  }
  if (data && typeof data === 'object') {
    const found = findRows(data)
    if (found.rows) {
      const sample = found.rows[0]
      return {
        kind: 'array',
        rowsPath: found.rowsPath,
        recordCount: found.rows.length,
        cardinality: cardinalityBucket(found.rows.length),
        fields: fieldsFromRecord(sample),
        series: Boolean(found.series),
      }
    }
    return {
      kind: 'object',
      rowsPath: null,
      recordCount: 1,
      cardinality: '1',
      fields: fieldsFromRecord(data),
    }
  }
  return {
    kind: 'primitive',
    primitiveType: valueType(data),
    rowsPath: null,
    recordCount: 0,
    cardinality: '0',
    fields: [],
  }
}

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32)
}

export function shapeHash(shape) {
  return stableHash({
    kind: shape.kind,
    rowsPath: shape.rowsPath,
    primitiveType: shape.primitiveType || null,
    fields: (shape.fields || []).map((f) => ({ key: f.key, type: f.type })),
  })
}

export function fingerprint(shape, instructions, designSystemId, packKey = '') {
  return stableHash({
    shape: shapeHash(shape),
    cardinality: shape.cardinality,
    instructions: normalizeInstructions(instructions),
    designSystem: designSystemId || '',
    pack: packKey || '',
  })
}
