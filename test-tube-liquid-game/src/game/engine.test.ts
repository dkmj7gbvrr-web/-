import { describe, expect, it } from 'vitest'
import { canPour, isSolved, isTubeSorted, pour, topRun } from './engine'
import { generatePuzzle } from './generator'
import { isSolvable } from './solver'
import type { Tube } from './types'

// Deterministic PRNG (mulberry32) so generator tests are reproducible.
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('topRun', () => {
  it('returns null for an empty tube', () => {
    expect(topRun([])).toBeNull()
  })

  it('counts the contiguous run at the top only', () => {
    expect(topRun([1, 2, 2, 2])).toEqual({ color: 2, count: 3 })
    expect(topRun([2, 2, 2, 1])).toEqual({ color: 1, count: 1 })
  })
})

describe('canPour / pour', () => {
  it('allows pouring onto an empty tube and moves the whole top run', () => {
    const source: Tube = [1, 2, 2, 2]
    const target: Tube = []
    expect(canPour(source, target, 4)).toBe(true)
    const result = pour(source, target, 4)
    expect(result.moved).toBe(3)
    expect(result.source).toEqual([1])
    expect(result.target).toEqual([2, 2, 2])
  })

  it('rejects pouring onto a tube whose top color differs', () => {
    const source: Tube = [2, 2]
    const target: Tube = [1]
    expect(canPour(source, target, 4)).toBe(false)
    expect(pour(source, target, 4).moved).toBe(0)
  })

  it('rejects pouring into a full tube', () => {
    const source: Tube = [1, 1]
    const target: Tube = [2, 2, 2, 2]
    expect(canPour(source, target, 4)).toBe(false)
  })

  it('rejects pouring from an empty tube', () => {
    expect(canPour([], [1], 4)).toBe(false)
  })

  it('moves only as many units as fit, leaving the rest behind (partial pour)', () => {
    const source: Tube = [1, 2, 2, 2]
    const target: Tube = [5, 2]
    expect(canPour(source, target, 4)).toBe(true)
    const result = pour(source, target, 4)
    expect(result.moved).toBe(2)
    expect(result.source).toEqual([1, 2])
    expect(result.target).toEqual([5, 2, 2, 2])
  })
})

describe('isTubeSorted / isSolved', () => {
  it('treats empty tubes and full single-color tubes as sorted', () => {
    expect(isTubeSorted([], 4)).toBe(true)
    expect(isTubeSorted([3, 3, 3, 3], 4)).toBe(true)
  })

  it('treats a partially filled or mixed tube as unsorted', () => {
    expect(isTubeSorted([3, 3], 4)).toBe(false)
    expect(isTubeSorted([3, 3, 3, 1], 4)).toBe(false)
  })

  it('isSolved requires every tube to be sorted', () => {
    expect(
      isSolved(
        [
          [1, 1],
          [2, 2],
        ],
        2,
      ),
    ).toBe(true)
    expect(
      isSolved(
        [
          [1, 2],
          [2, 1],
        ],
        2,
      ),
    ).toBe(false)
  })
})

describe('isSolvable', () => {
  it('confirms a small hand-built solvable layout', () => {
    const tubes: Tube[] = [
      [1, 2],
      [2, 1],
      [],
    ]
    expect(isSolvable(tubes, 2)).toBe(true)
  })

  it('detects a deadlocked layout with zero legal moves as unsolvable', () => {
    const tubes: Tube[] = [
      [1, 2],
      [2, 1],
    ]
    expect(isSolvable(tubes, 2)).toBe(false)
  })

  it('treats an already-solved layout as solvable', () => {
    const tubes: Tube[] = [
      [1, 1],
      [2, 2],
      [],
    ]
    expect(isSolvable(tubes, 2)).toBe(true)
  })
})

describe('generatePuzzle', () => {
  const configs = [
    { colorCount: 4, capacity: 4, emptyTubes: 2 },
    { colorCount: 6, capacity: 4, emptyTubes: 2 },
    { colorCount: 8, capacity: 4, emptyTubes: 2 },
    { colorCount: 12, capacity: 4, emptyTubes: 2 },
  ]

  describe.each(configs)('colorCount=%o', (config) => {
    it('produces a solvable, not-already-solved, ball-count-preserving layout across several seeds', () => {
      for (let seed = 1; seed <= 5; seed++) {
        const tubes = generatePuzzle({ ...config, random: mulberry32(seed * 97 + config.colorCount) })

        expect(tubes.length).toBe(config.colorCount + config.emptyTubes)
        expect(isSolved(tubes, config.capacity)).toBe(false)

        const counts = new Array(config.colorCount).fill(0)
        for (const tube of tubes) {
          expect(tube.length).toBeLessThanOrEqual(config.capacity)
          for (const color of tube) counts[color]++
        }
        for (const count of counts) expect(count).toBe(config.capacity)

        expect(isSolvable(tubes, config.capacity)).toBe(true)
      }
    })
  })

  it('stays fast even at the hardest difficulty (regression guard against solver blow-up)', () => {
    const start = Date.now()
    for (let i = 0; i < 10; i++) {
      generatePuzzle({ colorCount: 12, capacity: 4, emptyTubes: 2, random: mulberry32(i + 1) })
    }
    expect(Date.now() - start).toBeLessThan(5000)
  })
})
