import { CELL_COUNT, bitsToDigits, cloneGrid, computeCandidates, popcount } from './board'
import type { Rng } from './rng'
import type { Digit, Grid } from './types'

const shuffle = <T,>(arr: T[], rng: Rng): T[] => {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 候補数が最も少ない空マスを探す（MRVヒューリスティック）。無ければ-1 */
const pickMrvCell = (grid: Grid, candidates: number[]): number => {
  let best = -1
  let bestCount = 10
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] !== 0) continue
    const count = popcount(candidates[i])
    if (count === 0) return i // すぐに矛盾を検知して打ち切れるよう最優先で返す
    if (count < bestCount) {
      bestCount = count
      best = i
      if (bestCount === 1) break
    }
  }
  return best
}

/**
 * バックトラッキングで解を1つ探す。randomize=trueならランダムな完全盤面生成に使える
 * （その場合、rngを渡すと同じseedから常に同じ盤面を再現できる）。
 */
export const solveOne = (grid: Grid, randomize = false, rng: Rng = Math.random): Grid | null => {
  const work = cloneGrid(grid)

  const backtrack = (): boolean => {
    const candidates = computeCandidates(work)
    const cell = pickMrvCell(work, candidates)
    if (cell === -1) return true // 空マスなし＝完成

    const mask = candidates[cell]
    if (mask === 0) return false // 矛盾

    let digits = bitsToDigits(mask)
    if (randomize) digits = shuffle(digits, rng)

    for (const d of digits) {
      work[cell] = d
      if (backtrack()) return true
      work[cell] = 0
    }
    return false
  }

  return backtrack() ? work : null
}

/** limit件に達するまで解の個数を数える（一意解判定に使用。通常は limit=2 で十分） */
export const countSolutions = (grid: Grid, limit = 2): number => {
  const work = cloneGrid(grid)
  let count = 0

  const backtrack = (): void => {
    if (count >= limit) return
    const candidates = computeCandidates(work)
    const cell = pickMrvCell(work, candidates)
    if (cell === -1) {
      count++
      return
    }
    const mask = candidates[cell]
    if (mask === 0) return

    for (const d of bitsToDigits(mask)) {
      work[cell] = d
      backtrack()
      work[cell] = 0
      if (count >= limit) return
    }
  }

  backtrack()
  return count
}

export const hasUniqueSolution = (grid: Grid): boolean => countSolutions(grid, 2) === 1

/** ランダムな完成済みナンプレ盤面を1つ生成する（rngを渡せば再現可能） */
export const generateSolvedGrid = (rng: Rng = Math.random): Grid => {
  const empty: Grid = new Array(CELL_COUNT).fill(0) as Digit[]
  const solved = solveOne(empty, true, rng)
  if (!solved) throw new Error('failed to generate a solved grid')
  return solved
}
