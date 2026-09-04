import type { Digit, Grid } from './types'

export const SIZE = 9
export const BOX_SIZE = 3
export const CELL_COUNT = 81

export const rowOf = (i: number): number => Math.floor(i / SIZE)
export const colOf = (i: number): number => i % SIZE
export const boxOf = (i: number): number => {
  const r = rowOf(i)
  const c = colOf(i)
  return Math.floor(r / BOX_SIZE) * BOX_SIZE + Math.floor(c / BOX_SIZE)
}
export const indexOf = (r: number, c: number): number => r * SIZE + c

/** 各行・列・箱に属するマスのインデックス一覧 */
export const ROWS: number[][] = Array.from({ length: SIZE }, (_, r) =>
  Array.from({ length: SIZE }, (_, c) => indexOf(r, c)),
)
export const COLS: number[][] = Array.from({ length: SIZE }, (_, c) =>
  Array.from({ length: SIZE }, (_, r) => indexOf(r, c)),
)
export const BOXES: number[][] = Array.from({ length: SIZE }, (_, b) => {
  const br = Math.floor(b / BOX_SIZE) * BOX_SIZE
  const bc = (b % BOX_SIZE) * BOX_SIZE
  const cells: number[] = []
  for (let dr = 0; dr < BOX_SIZE; dr++) {
    for (let dc = 0; dc < BOX_SIZE; dc++) {
      cells.push(indexOf(br + dr, bc + dc))
    }
  }
  return cells
})

/** 各マスが属する3つの「単位」（行・列・箱）のインデックス一覧のリスト */
export const UNITS: number[][][] = Array.from({ length: CELL_COUNT }, (_, i) => [
  ROWS[rowOf(i)],
  COLS[colOf(i)],
  BOXES[boxOf(i)],
])

/** 各マスについて、同じ行・列・箱を共有する他マス（自身を除く）のインデックス集合 */
export const PEERS: number[][] = Array.from({ length: CELL_COUNT }, (_, i) => {
  const set = new Set<number>()
  for (const unit of UNITS[i]) {
    for (const cell of unit) {
      if (cell !== i) set.add(cell)
    }
  }
  return Array.from(set)
})

export const emptyGrid = (): Grid => new Array(CELL_COUNT).fill(0) as Grid

export const cloneGrid = (grid: Grid): Grid => grid.slice() as Grid

/** 指定マスに digit を置けるか（行・列・箱で重複しないか） */
export const canPlace = (grid: Grid, index: number, digit: Digit): boolean => {
  if (digit === 0) return true
  for (const peer of PEERS[index]) {
    if (grid[peer] === digit) return false
  }
  return true
}

/** 空マスごとの候補（1〜9のビットマスク、bit(d-1)が立っていればdが候補） */
export type CandidateMap = number[]

export const FULL_MASK = 0b111111111

export const digitBit = (digit: Digit): number => 1 << (digit - 1)

export const bitsToDigits = (mask: number): Digit[] => {
  const digits: Digit[] = []
  for (let d = 1; d <= 9; d++) {
    if (mask & digitBit(d as Digit)) digits.push(d as Digit)
  }
  return digits
}

export const popcount = (mask: number): number => {
  let count = 0
  let m = mask
  while (m) {
    m &= m - 1
    count++
  }
  return count
}

/** 現在の盤面から、空マスごとの候補ビットマスクを計算する */
export const computeCandidates = (grid: Grid): CandidateMap => {
  const candidates: CandidateMap = new Array(CELL_COUNT).fill(0)
  for (let i = 0; i < CELL_COUNT; i++) {
    if (grid[i] !== 0) continue
    let mask = FULL_MASK
    for (const peer of PEERS[i]) {
      const v = grid[peer]
      if (v !== 0) mask &= ~digitBit(v as Digit)
    }
    candidates[i] = mask
  }
  return candidates
}

export const isComplete = (grid: Grid): boolean => grid.every((v) => v !== 0)

export const gridsEqual = (a: Grid, b: Grid): boolean => a.every((v, i) => v === b[i])

export const cellLabel = (i: number): string => `${rowOf(i) + 1}行${colOf(i) + 1}列`

export const boxLabel = (b: number): string => `ブロック${b + 1}`

export const rowLabel = (r: number): string => `${r + 1}行目`

export const colLabel = (c: number): string => `${c + 1}列目`
