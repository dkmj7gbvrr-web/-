import { canPour, isSolved, isTubeSorted, pour } from './engine'
import type { Tube } from './types'

function canonicalKey(tubes: Tube[]): string {
  return tubes
    .map((t) => t.join(','))
    .sort()
    .join('|')
}

function candidateMoves(tubes: Tube[], capacity: number): Array<[number, number]> {
  const moves: Array<[number, number]> = []
  for (let i = 0; i < tubes.length; i++) {
    if (tubes[i].length === 0) continue
    // a full, single-color tube is already solved; pouring out of it never helps
    if (isTubeSorted(tubes[i], capacity) && tubes[i].length === capacity) continue
    for (let j = 0; j < tubes.length; j++) {
      if (i === j) continue
      if (!canPour(tubes[i], tubes[j], capacity)) continue
      moves.push([i, j])
    }
  }
  return moves
}

/**
 * Depth-first search with canonical-state memoization, bounded by nodeBudget.
 * Returns true only when a solution path was actually found; returns false both
 * for genuinely unsolvable states and for "gave up within the budget" states, so
 * callers should treat false as "discard and try another deal", not as proof.
 */
export function isSolvable(tubes: Tube[], capacity: number, nodeBudget = 150000): boolean {
  if (isSolved(tubes, capacity)) return true

  const visited = new Set<string>([canonicalKey(tubes)])
  const stack: Tube[][] = [tubes]
  let nodes = 0

  while (stack.length > 0) {
    if (nodes++ > nodeBudget) return false
    const state = stack.pop()!
    for (const [i, j] of candidateMoves(state, capacity)) {
      const result = pour(state[i], state[j], capacity)
      if (result.moved === 0) continue
      const next = state.slice()
      next[i] = result.source
      next[j] = result.target
      if (isSolved(next, capacity)) return true
      const key = canonicalKey(next)
      if (visited.has(key)) continue
      visited.add(key)
      stack.push(next)
    }
  }
  return false
}
