import { describe, it, expect } from 'vitest'
import { es } from '../i18n/es'
import { en } from '../i18n/en'
import { fill } from '../i18n'

function leaves(o: unknown, path = ''): Array<[string, unknown]> {
  if (typeof o === 'string') return [[path, o]]
  if (o && typeof o === 'object') {
    return Object.entries(o).flatMap(([k, v]) =>
      leaves(v, path ? `${path}.${k}` : k)
    )
  }
  return [[path, o]]
}

describe('i18n (P3-D4)', () => {
  it('es y en tienen las mismas claves y sin vacíos', () => {
    const a = new Map(leaves(es))
    const b = new Map(leaves(en))
    expect([...a.keys()].sort()).toEqual([...b.keys()].sort())
    for (const [k, v] of a) {
      expect(typeof v, k).toBe('string')
      expect((v as string).length, k).toBeGreaterThan(0)
      expect(typeof b.get(k), k).toBe('string')
    }
  })

  it('fill sustituye placeholders', () => {
    expect(fill('Ronda {n}', { n: 3 })).toBe('Ronda 3')
    expect(fill('a {x} b {y}', { x: 1, y: 2 })).toBe('a 1 b 2')
    expect(fill('sin vars')).toBe('sin vars')
  })
})
