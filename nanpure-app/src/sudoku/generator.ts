import { cloneGrid, computeCandidates, isComplete } from './board'
import { applyStepToCandidates, findNextStep } from './techniques'
import { mulberry32, randomSeed } from './rng'
import type { Rng } from './rng'
import { countSolutions, generateSolvedGrid } from './solver'
import type { Difficulty, GeneratedPuzzle, Grid, TechniqueTier } from './types'

interface DifficultyRange {
  /** これ以上は間引かない下限ヒント数（唯一解を保てる場合でも、この数までで打ち切る） */
  minGivenFloor: number
  minTier: TechniqueTier
  maxTier: TechniqueTier
  /** trueなら実装済み技巧だけでは解けない（手詰まり=6）状態を要求する */
  requireStuck?: boolean
}

const RANGES: Record<Difficulty, DifficultyRange> = {
  1: { minGivenFloor: 34, minTier: 1, maxTier: 1 },
  2: { minGivenFloor: 28, minTier: 2, maxTier: 3 },
  3: { minGivenFloor: 25, minTier: 3, maxTier: 4 },
  4: { minGivenFloor: 22, minTier: 4, maxTier: 5 },
  5: { minGivenFloor: 20, minTier: 5, maxTier: 6, requireStuck: true },
}

const shuffledIndices = (rng: Rng): number[] => {
  const arr = Array.from({ length: 81 }, (_, i) => i)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const countGivens = (grid: Grid): number => grid.filter((v) => v !== 0).length

/**
 * 実装済みの人間的解法テクニックだけで解けるかを評価する。手詰まりの場合はtier=6を返す。
 * ceilingを指定すると、それを上回るtierが判明した時点で以降の求解を打ち切り即座に返す
 * （carve中の「上限を超えないか」だけを高速に判定したい場合に使う）。
 */
const rateDifficulty = (puzzle: Grid, ceiling?: TechniqueTier): TechniqueTier => {
  const grid = cloneGrid(puzzle)
  let candidates = computeCandidates(grid)
  let maxTier: TechniqueTier = 0
  let guard = 0

  while (!isComplete(grid)) {
    guard++
    if (guard > 500) return 6

    const step = findNextStep(grid, candidates)
    if (!step) return 6

    if (step.tier > maxTier) {
      maxTier = step.tier
      if (ceiling !== undefined && maxTier > ceiling) return maxTier
    }

    if (step.fill) {
      grid[step.fill.index] = step.fill.digit
      candidates = computeCandidates(grid)
    } else {
      candidates = applyStepToCandidates(candidates, step)
    }
  }

  return maxTier === 0 ? 1 : maxTier
}

const MAX_CARVE_PASSES = 4

/**
 * 完成盤面から一意解を保ちながら間引く。
 * requireStuck指定時は「唯一解である限りできるだけ間引く」（できるだけ手がかりを減らし、
 * 実装済み技巧だけでは解けない手詰まり状態を狙う）。
 * それ以外はmaxTierを超えない範囲でできるだけ間引く（マス除去のたびに評価し直し、
 * 難易度の上限を超える除去は取り消す）ことで、指定難易度ぎりぎりの問題を作る。
 */
const carve = (solved: Grid, range: DifficultyRange, rng: Rng): Grid => {
  const grid = cloneGrid(solved)

  for (let pass = 0; pass < MAX_CARVE_PASSES; pass++) {
    let improved = false
    for (const cell of shuffledIndices(rng)) {
      if (countGivens(grid) <= range.minGivenFloor) return grid
      if (grid[cell] === 0) continue

      const backup = grid[cell]
      grid[cell] = 0

      if (countSolutions(grid, 2) !== 1) {
        grid[cell] = backup
        continue
      }

      if (!range.requireStuck) {
        const tier = rateDifficulty(grid, range.maxTier)
        if (tier > range.maxTier) {
          grid[cell] = backup
          continue
        }
      }

      improved = true
    }
    if (!improved) break
  }
  return grid
}

export interface GeneratePuzzleOptions {
  /**
   * 生成に使う乱数のseed。同じ難易度・同じseedを指定すると常に同一の問題が生成される
   * （URLなどで問題を共有し、複数人が全く同じ盤面で対戦するのに使う）。省略時はランダム。
   */
  seed?: number
  maxAttempts?: number
}

/**
 * 指定難易度のナンプレを生成する。
 * 完成盤面をランダム生成→難易度上限を超えない範囲でできるだけ間引く→実装済み技巧で評価、を
 * 目標の難易度レンジに達するかmaxAttemptsに達するまで繰り返す。
 * 生成過程はすべてseedから作った乱数生成器（rng）にのみ依存するため、同じseedからは
 * 実行環境やタイミングに関わらず常にビット単位で同一の問題が再現される。
 */
export const generatePuzzle = (difficulty: Difficulty, options: GeneratePuzzleOptions = {}): GeneratedPuzzle => {
  const seed = options.seed ?? randomSeed()
  const maxAttempts = options.maxAttempts ?? 40
  const rng = mulberry32(seed)
  const range = RANGES[difficulty]
  let best: GeneratedPuzzle | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = generateSolvedGrid(rng)
    const puzzle = carve(solution, range, rng)
    const givenCount = countGivens(puzzle)
    const ratedTier = rateDifficulty(puzzle)

    const tierOk = range.requireStuck
      ? ratedTier >= range.minTier
      : ratedTier >= range.minTier && ratedTier <= range.maxTier

    const candidate: GeneratedPuzzle = {
      puzzle,
      solution,
      difficulty,
      givenCount,
      ratedTier,
      seed,
    }

    if (tierOk) return candidate

    if (!best) {
      best = candidate
    } else {
      const bestDiff = Math.abs(best.ratedTier - range.minTier)
      const candDiff = Math.abs(ratedTier - range.minTier)
      if (candDiff < bestDiff) best = candidate
    }
  }

  return best as GeneratedPuzzle
}
