import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import {
  applyGravity,
  createRandomBoard,
  findMatchGroups,
  isAdjacent,
  refill,
  removeGroups,
  resolveCascadeSteps,
  resolveCascades,
  swapCells,
  type Board,
} from './board'

describe('createRandomBoard', () => {
  it('生成直後は3つ揃いを含まない', () => {
    for (let seed = 0; seed < 20; seed++) {
      const board = createRandomBoard(mulberry32(seed))
      expect(findMatchGroups(board)).toHaveLength(0)
    }
  })

  it('指定したサイズの盤面を生成する', () => {
    const board = createRandomBoard(mulberry32(1), 5, 6)
    expect(board.length).toBe(5)
    expect(board[0].length).toBe(6)
  })
})

describe('isAdjacent', () => {
  it('上下左右に隣接している場合はtrue', () => {
    expect(isAdjacent({ row: 1, col: 1 }, { row: 1, col: 2 })).toBe(true)
    expect(isAdjacent({ row: 1, col: 1 }, { row: 2, col: 1 })).toBe(true)
  })

  it('斜めや同一マスはfalse', () => {
    expect(isAdjacent({ row: 1, col: 1 }, { row: 2, col: 2 })).toBe(false)
    expect(isAdjacent({ row: 1, col: 1 }, { row: 1, col: 1 })).toBe(false)
  })
})

describe('swapCells', () => {
  it('2マスの中身を入れ替える', () => {
    const board: Board = [
      ['fire', 'water'],
      ['wood', 'light'],
    ]
    const swapped = swapCells(board, { row: 0, col: 0 }, { row: 0, col: 1 })
    expect(swapped[0][0]).toBe('water')
    expect(swapped[0][1]).toBe('fire')
    // 元の盤面は変更されない（イミュータブル）
    expect(board[0][0]).toBe('fire')
  })
})

describe('findMatchGroups', () => {
  it('横一列3つ揃いを検出する', () => {
    const board: Board = [
      ['fire', 'fire', 'fire', 'water'],
      ['water', 'wood', 'light', 'dark'],
    ]
    const groups = findMatchGroups(board)
    expect(groups).toHaveLength(1)
    expect(groups[0].element).toBe('fire')
    expect(groups[0].cells).toHaveLength(3)
  })

  it('縦一列3つ揃いを検出する', () => {
    const board: Board = [['fire'], ['fire'], ['fire'], ['water']]
    const groups = findMatchGroups(board)
    expect(groups).toHaveLength(1)
    expect(groups[0].cells).toHaveLength(3)
  })

  it('L字などで繋がった同色マスは1つのコンボとして結合される', () => {
    // fire fire fire
    // fire  ---  ---
    // fire  ---  ---
    const board: Board = [
      ['fire', 'fire', 'fire'],
      ['fire', 'water', 'water'],
      ['fire', 'wood', 'wood'],
    ]
    const groups = findMatchGroups(board)
    expect(groups).toHaveLength(1)
    expect(groups[0].cells).toHaveLength(5)
  })

  it('離れた同色の3つ揃いは別コンボとして数える', () => {
    const board: Board = [
      ['fire', 'fire', 'fire', 'water', 'water', 'water'],
      ['wood', 'wood', 'wood', 'light', 'light', 'light'],
    ]
    const groups = findMatchGroups(board)
    expect(groups).toHaveLength(4)
  })

  it('2つ揃いはマッチとみなさない', () => {
    const board: Board = [['fire', 'fire', 'water']]
    expect(findMatchGroups(board)).toHaveLength(0)
  })
})

describe('removeGroups + applyGravity', () => {
  it('マッチしたマスを消すとその列は空になる', () => {
    const board: Board = [['fire'], ['fire'], ['fire']]
    const groups = findMatchGroups(board)
    const removed = removeGroups(board, groups)
    expect(removed[0][0]).toBeNull()
    expect(removed[1][0]).toBeNull()
    expect(removed[2][0]).toBeNull()
  })

  it('残ったオーブは列内で下に寄る', () => {
    const board: Board = [['fire'], [null], ['water']]
    const dropped = applyGravity(board)
    expect(dropped[0][0]).toBeNull()
    expect(dropped[1][0]).toBe('fire')
    expect(dropped[2][0]).toBe('water')
  })
})

describe('refill', () => {
  it('空マスだけを乱数で埋め、既存のオーブは変えない', () => {
    const board: Board = [['fire', null, 'water']]
    const filled = refill(board, mulberry32(1))
    expect(filled[0][0]).toBe('fire')
    expect(filled[0][2]).toBe('water')
    expect(filled[0][1]).not.toBeNull()
  })
})

describe('resolveCascades', () => {
  it('マッチがなければグループは空で盤面はそのまま', () => {
    const board = createRandomBoard(mulberry32(2))
    const result = resolveCascades(board, mulberry32(2))
    expect(result.groups).toHaveLength(0)
    expect(result.finalBoard).toEqual(board)
  })

  it('連鎖が起きた場合は複数コンボとして集計され、最終盤面にマッチが残らない', () => {
    const board: Board = [
      ['fire', 'fire', 'fire', 'water', 'water', 'water'],
      ['wood', 'light', 'dark', 'wood', 'light', 'dark'],
    ]
    const result = resolveCascades(board, mulberry32(10))
    expect(result.groups.length).toBeGreaterThanOrEqual(2)
    expect(findMatchGroups(result.finalBoard)).toHaveLength(0)
  })
})

describe('resolveCascadeSteps', () => {
  it('マッチがなければステップは空になる', () => {
    const board = createRandomBoard(mulberry32(2))
    expect(resolveCascadeSteps(board, mulberry32(2))).toHaveLength(0)
  })

  it('連鎖するとステップが複数回に分かれ、各ステップのboardAfterSettleが次のステップの入力になる', () => {
    const board: Board = [
      ['fire', 'fire', 'fire', 'water', 'water', 'water'],
      ['wood', 'light', 'dark', 'wood', 'light', 'dark'],
    ]
    const steps = resolveCascadeSteps(board, mulberry32(10))
    expect(steps.length).toBeGreaterThanOrEqual(1)

    for (const step of steps) {
      // boardAfterClearはマッチしたマスがすべて空になっている
      for (const { row, col } of step.matchedCells) {
        expect(step.boardAfterClear[row][col]).toBeNull()
      }
      // boardAfterSettleは落下・補充が完了しており、空マスが一切残っていない
      expect(step.boardAfterSettle.flat().every((cell) => cell !== null)).toBe(true)
    }

    // resolveCascadesの最終盤面・合計コンボ数と整合する
    const combined = resolveCascades(board, mulberry32(10))
    expect(steps.at(-1)?.boardAfterSettle).toEqual(combined.finalBoard)
    expect(steps.reduce((sum, s) => sum + s.groups.length, 0)).toBe(combined.groups.length)
  })
})
