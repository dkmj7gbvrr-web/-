import { describe, expect, it } from 'vitest'
import { gridsEqual, isComplete } from './board'
import { generatePuzzle } from './generator'
import { countSolutions, hasUniqueSolution, solveOne } from './solver'
import { applyStepToCandidates, findNextStep } from './techniques'
import { computeCandidates } from './board'
import type { Difficulty, Grid } from './types'

const DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5]

describe('solver', () => {
  it('generates a fully valid solved grid', () => {
    const empty: Grid = new Array(81).fill(0)
    const solved = solveOne(empty, true)
    expect(solved).not.toBeNull()
    expect(isComplete(solved!)).toBe(true)
    expect(hasUniqueSolution(solved!)).toBe(true)
  })
})

describe.each(DIFFICULTIES)('generatePuzzle(level=%i)', (level) => {
  it('produces a puzzle with a unique solution matching the real solution', () => {
    const { puzzle, solution } = generatePuzzle(level)
    expect(hasUniqueSolution(puzzle)).toBe(true)
    const solved = solveOne(puzzle)
    expect(solved).not.toBeNull()
    expect(gridsEqual(solved!, solution)).toBe(true)
    // givens must be consistent with the solution
    for (let i = 0; i < 81; i++) {
      if (puzzle[i] !== 0) expect(puzzle[i]).toBe(solution[i])
    }
  })

  it('has more than one solution when a random extra clue is removed (sanity: not over-constrained)', () => {
    const { puzzle } = generatePuzzle(level)
    const givenCount = puzzle.filter((v) => v !== 0).length
    expect(givenCount).toBeGreaterThanOrEqual(17)
  })
})

describe('technique solver / hint chain', () => {
  it('can fully solve every generated puzzle using findNextStep chained with a real solution fallback', () => {
    for (const level of DIFFICULTIES) {
      const { puzzle, solution } = generatePuzzle(level)
      const grid = puzzle.slice()
      let candidates = computeCandidates(grid)
      let guard = 0
      while (!isComplete(grid)) {
        guard++
        expect(guard).toBeLessThan(1000)
        const step = findNextStep(grid, candidates)
        if (!step) {
          // 手詰まり（最難関で起こりうる）：既知の解から1マス埋めて継続できることを確認
          const idx = grid.findIndex((v) => v === 0)
          grid[idx] = solution[idx]
          candidates = computeCandidates(grid)
          continue
        }
        if (step.fill) {
          expect(solution[step.fill.index]).toBe(step.fill.digit)
          grid[step.fill.index] = step.fill.digit
          candidates = computeCandidates(grid)
        } else {
          // すべての除外が正しい（解の数字を除外していない）ことを検証
          for (const e of step.eliminations) {
            expect(solution[e.index]).not.toBe(e.digit)
          }
          candidates = applyStepToCandidates(candidates, step)
        }
      }
      expect(gridsEqual(grid, solution)).toBe(true)
    }
  })
})

describe('countSolutions', () => {
  it('detects multiple solutions for an under-constrained grid', () => {
    const empty: Grid = new Array(81).fill(0)
    expect(countSolutions(empty, 2)).toBe(2)
  })
})
