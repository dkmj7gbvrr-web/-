import type { Tube } from './types'

export interface TopRun {
  color: number
  count: number
}

export function topRun(tube: Tube): TopRun | null {
  if (tube.length === 0) return null
  const color = tube[tube.length - 1]
  let count = 0
  for (let i = tube.length - 1; i >= 0; i--) {
    if (tube[i] !== color) break
    count++
  }
  return { color, count }
}

export function canPour(source: Tube, target: Tube, capacity: number): boolean {
  const run = topRun(source)
  if (!run) return false
  if (target.length >= capacity) return false
  if (target.length === 0) return true
  return target[target.length - 1] === run.color
}

export interface PourResult {
  source: Tube
  target: Tube
  moved: number
}

export function pour(source: Tube, target: Tube, capacity: number): PourResult {
  const run = topRun(source)
  if (!run || !canPour(source, target, capacity)) {
    return { source, target, moved: 0 }
  }
  const space = capacity - target.length
  const moved = Math.min(run.count, space)
  const newSource = source.slice(0, source.length - moved)
  const newTarget = [...target, ...Array<number>(moved).fill(run.color)]
  return { source: newSource, target: newTarget, moved }
}

export function isTubeSorted(tube: Tube, capacity: number): boolean {
  if (tube.length === 0) return true
  if (tube.length !== capacity) return false
  return tube.every((c) => c === tube[0])
}

export function isSolved(tubes: Tube[], capacity: number): boolean {
  return tubes.every((t) => isTubeSorted(t, capacity))
}
