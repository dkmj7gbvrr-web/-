import { isSolvable } from './solver'
import type { Tube } from './types'

export interface GenerateOptions {
  colorCount: number
  capacity: number
  emptyTubes: number
  random?: () => number
  maxAttempts?: number
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function deal(colorCount: number, capacity: number, emptyTubes: number, random: () => number): Tube[] {
  const balls: number[] = []
  for (let color = 0; color < colorCount; color++) {
    for (let n = 0; n < capacity; n++) balls.push(color)
  }
  const shuffled = shuffle(balls, random)
  const tubes: Tube[] = []
  for (let t = 0; t < colorCount; t++) {
    tubes.push(shuffled.slice(t * capacity, (t + 1) * capacity))
  }
  for (let e = 0; e < emptyTubes; e++) tubes.push([])
  return tubes
}

/**
 * Deals colors into tubes at random and keeps re-dealing until a solvable,
 * not-already-solved layout is confirmed by the solver.
 */
export function generatePuzzle(options: GenerateOptions): Tube[] {
  const { colorCount, capacity, emptyTubes, random = Math.random, maxAttempts = 300 } = options

  let lastAttempt: Tube[] | null = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tubes = deal(colorCount, capacity, emptyTubes, random)
    lastAttempt = tubes
    const alreadySolved = tubes.every((t) => t.length === 0 || (t.length === capacity && t.every((c) => c === t[0])))
    if (alreadySolved) continue
    if (isSolvable(tubes, capacity)) return tubes
  }
  // Extremely unlikely fallback: hand back the last deal rather than looping forever.
  return lastAttempt ?? []
}
