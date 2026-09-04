import { ALL_ORB_ELEMENTS } from './types'
import type { Element } from './types'
import type { Rng } from './rng'
import { pickInt } from './rng'

export const BOARD_ROWS = 5
export const BOARD_COLS = 6

export interface Position {
  readonly row: number
  readonly col: number
}

export type Cell = Element | null
export type Board = readonly (readonly Cell[])[]

export interface MatchGroup {
  readonly element: Element
  readonly cells: readonly Position[]
}

const randomElement = (rng: Rng): Element => ALL_ORB_ELEMENTS[pickInt(rng, ALL_ORB_ELEMENTS.length)]

const wouldMatch = (grid: Cell[][], row: number, col: number, element: Element): boolean => {
  if (col >= 2 && grid[row][col - 1] === element && grid[row][col - 2] === element) return true
  if (row >= 2 && grid[row - 1][col] === element && grid[row - 2][col] === element) return true
  return false
}

/** 初期盤面を生成する。生成直後に3つ揃いができないよう配置する */
export const createRandomBoard = (
  rng: Rng,
  rows: number = BOARD_ROWS,
  cols: number = BOARD_COLS,
): Board => {
  const grid: Cell[][] = Array.from({ length: rows }, () => new Array<Cell>(cols).fill(null))
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let element = randomElement(rng)
      let guard = 0
      while (wouldMatch(grid, row, col, element) && guard < 20) {
        element = randomElement(rng)
        guard++
      }
      grid[row][col] = element
    }
  }
  return grid
}

export const isAdjacent = (a: Position, b: Position): boolean => {
  const dr = Math.abs(a.row - b.row)
  const dc = Math.abs(a.col - b.col)
  return dr + dc === 1
}

export const swapCells = (board: Board, a: Position, b: Position): Board => {
  const next = board.map((row) => row.slice())
  const tmp = next[a.row][a.col]
  next[a.row][a.col] = next[b.row][b.col]
  next[b.row][b.col] = tmp
  return next
}

/**
 * 盤面上の3つ以上揃いを検出する。行・列のランを検出したあと、
 * 同色で隣接するマスを結合して1つのコンボグループにまとめる（実機パズドラ準拠のロジック）。
 */
export const findMatchGroups = (board: Board): MatchGroup[] => {
  const rows = board.length
  const cols = board[0]?.length ?? 0
  const matched: boolean[][] = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false))

  for (let row = 0; row < rows; row++) {
    let runStart = 0
    for (let col = 1; col <= cols; col++) {
      const prev = board[row][col - 1]
      const curr = col < cols ? board[row][col] : null
      if (curr !== prev || curr === null) {
        const runLength = col - runStart
        if (prev !== null && runLength >= 3) {
          for (let c = runStart; c < col; c++) matched[row][c] = true
        }
        runStart = col
      }
    }
  }

  for (let col = 0; col < cols; col++) {
    let runStart = 0
    for (let row = 1; row <= rows; row++) {
      const prev = board[row - 1][col]
      const curr = row < rows ? board[row][col] : null
      if (curr !== prev || curr === null) {
        const runLength = row - runStart
        if (prev !== null && runLength >= 3) {
          for (let r = runStart; r < row; r++) matched[r][col] = true
        }
        runStart = row
      }
    }
  }

  const visited: boolean[][] = Array.from({ length: rows }, () => new Array<boolean>(cols).fill(false))
  const groups: MatchGroup[] = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!matched[row][col] || visited[row][col]) continue
      const element = board[row][col]
      if (element === null) continue

      const cells: Position[] = []
      const stack: Position[] = [{ row, col }]
      visited[row][col] = true

      while (stack.length > 0) {
        const pos = stack.pop() as Position
        cells.push(pos)
        const neighbors: Position[] = [
          { row: pos.row - 1, col: pos.col },
          { row: pos.row + 1, col: pos.col },
          { row: pos.row, col: pos.col - 1 },
          { row: pos.row, col: pos.col + 1 },
        ]
        for (const n of neighbors) {
          if (n.row < 0 || n.row >= rows || n.col < 0 || n.col >= cols) continue
          if (visited[n.row][n.col] || !matched[n.row][n.col]) continue
          if (board[n.row][n.col] !== element) continue
          visited[n.row][n.col] = true
          stack.push(n)
        }
      }

      groups.push({ element, cells })
    }
  }

  return groups
}

export const removeGroups = (board: Board, groups: readonly MatchGroup[]): Board => {
  const next = board.map((row) => row.slice())
  for (const group of groups) {
    for (const { row, col } of group.cells) {
      next[row][col] = null
    }
  }
  return next
}

/** 各列で空マスを下に詰め、上側に隙間を作る（オーブが落下する処理） */
export const applyGravity = (board: Board): Board => {
  const rows = board.length
  const cols = board[0]?.length ?? 0
  const next: Cell[][] = Array.from({ length: rows }, () => new Array<Cell>(cols).fill(null))

  for (let col = 0; col < cols; col++) {
    const values: Cell[] = []
    for (let row = 0; row < rows; row++) {
      const v = board[row][col]
      if (v !== null) values.push(v)
    }
    const offset = rows - values.length
    for (let i = 0; i < values.length; i++) {
      next[offset + i][col] = values[i]
    }
  }

  return next
}

export const refill = (board: Board, rng: Rng): Board => {
  return board.map((row) => row.map((cell) => (cell === null ? randomElement(rng) : cell)))
}

export interface CascadeResult {
  readonly finalBoard: Board
  readonly groups: readonly MatchGroup[]
}

/** マッチが無くなるまで「消去→落下→補充」を繰り返し、発生した全コンボを集計する */
export const resolveCascades = (board: Board, rng: Rng): CascadeResult => {
  let current = board
  const groups: MatchGroup[] = []

  for (;;) {
    const found = findMatchGroups(current)
    if (found.length === 0) break
    groups.push(...found)
    current = refill(applyGravity(removeGroups(current, found)), rng)
  }

  return { finalBoard: current, groups }
}
